import * as vscode from 'vscode'
import * as path from 'node:path'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import {
  writeVertoConfigFile,
  mergeIntoJsoncFile,
  readVertoConfigRawFile,
  isWorkspaceSetupComplete,
  type VertoConfig,
} from '@verto/config'
import {
  getViewerLogin,
  resolveOwner,
  listRepositories,
  listProjects,
  auditForWizard,
  buildWizardConfigComments,
} from '@verto/adapter-github'
import { getGitHubToken } from './authProvider.js'
import { getWorkspaceConfigPath } from './configLoader.js'

type SourcePick = vscode.QuickPickItem & {
  action: 'other' | 'repo' | 'project'
  repoName?: string
  projectNumber?: number
}

export interface RunSetupOptions {
  prefillFromWorkspace?: boolean
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
    return true
  } catch {
    return false
  }
}

export async function runSetup(_context: vscode.ExtensionContext, options?: RunSetupOptions): Promise<boolean> {
  const cfgPath = getWorkspaceConfigPath()
  const exists = await fileExists(cfgPath)

  if (exists) {
    try {
      const raw = await readVertoConfigRawFile(cfgPath)
      if (isWorkspaceSetupComplete(raw)) {
        const rerun = await vscode.window.showQuickPick(
          ['Yes, continue', 'No, cancel'],
          { title: 'Verto setup', placeHolder: 'Config exists — re-run setup?' },
        )
        if (rerun !== 'Yes, continue') return false
      }
    } catch {
      // allow setup to repair invalid files
    }
  }

  const adapterPick = await vscode.window.showQuickPick(
    [{ label: 'GitHub', description: 'Issues and Projects from GitHub' }],
    { title: 'Select your ticket/issue tracking system:', placeHolder: 'Choose adapter' },
  )
  if (!adapterPick) return false

  const token = await getGitHubToken()
  if (!token) {
    vscode.window.showErrorMessage('Verto: GitHub authentication was cancelled.')
    return false
  }

  let viewerLogin: string
  try {
    viewerLogin = await getViewerLogin(token)
  } catch (err) {
    vscode.window.showErrorMessage(`Verto: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }

  let owner = viewerLogin
  let ownerType: 'user' | 'organization' = 'user'
  let prefillRepository: string | undefined
  let prefillProjectNumber: number | undefined
  let prefillScope: 'project' | 'repository' | undefined

  if (options?.prefillFromWorkspace !== false && exists) {
    try {
      const raw = await readVertoConfigRawFile(cfgPath)
      const gh = raw.github as Record<string, unknown> | undefined
      if (gh) {
        if (typeof gh.owner === 'string') owner = gh.owner
        if (gh.ownerType === 'organization') ownerType = 'organization'
        if (gh.scope === 'project' || gh.scope === 'repository') prefillScope = gh.scope
        if (typeof gh.projectNumber === 'number') prefillProjectNumber = gh.projectNumber
        if (typeof gh.repository === 'string') prefillRepository = gh.repository
      }
    } catch {
      // ignore pre-fill errors
    }
  }

  let selected: { kind: 'repo'; name: string } | { kind: 'project'; number: number } | undefined

  while (!selected) {
    let repos: Awaited<ReturnType<typeof listRepositories>>
    let projects: Awaited<ReturnType<typeof listProjects>>
    try {
      ;[repos, projects] = await Promise.all([
        listRepositories(token, owner, ownerType),
        listProjects(token, owner, ownerType),
      ])
    } catch (err) {
      vscode.window.showErrorMessage(`Verto: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }

    const items: SourcePick[] = [
      { label: '$(globe) Source issues from another GitHub owner', action: 'other' },
      { label: '', kind: vscode.QuickPickItemKind.Separator, action: 'other' },
      { label: 'By Repository:', kind: vscode.QuickPickItemKind.Separator, action: 'other' },
    ]

    if (repos.length === 0) {
      items.push({ label: 'No repositories found.', kind: vscode.QuickPickItemKind.Separator, action: 'other' })
    } else {
      for (const r of repos) {
        items.push({
          label: `$(repo) ${r.name}`,
          description: owner,
          action: 'repo',
          repoName: r.name,
          picked: prefillScope === 'repository' && prefillRepository === r.name,
        })
      }
    }

    items.push({ label: 'By Project:', kind: vscode.QuickPickItemKind.Separator, action: 'other' })
    if (projects.length === 0) {
      items.push({ label: 'No projects found.', kind: vscode.QuickPickItemKind.Separator, action: 'other' })
    } else {
      for (const p of projects) {
        items.push({
          label: `$(project) #${p.number} ${p.title}`,
          description: owner,
          action: 'project',
          projectNumber: p.number,
          picked: prefillScope === 'project' && prefillProjectNumber === p.number,
        })
      }
    }

    const pick = await vscode.window.showQuickPick(items, {
      title: 'Select your issues source:',
      placeHolder: `Repository or project for ${owner}`,
    })
    if (!pick) return false

    if (pick.action === 'other' && pick.label.includes('another')) {
      const login = await vscode.window.showInputBox({
        title: 'Enter GitHub owner username:',
        placeHolder: 'owner login',
        value: owner !== viewerLogin ? owner : undefined,
      })
      if (!login?.trim()) return false
      try {
        const resolved = await resolveOwner(token, login.trim())
        owner = resolved.owner
        ownerType = resolved.ownerType
      } catch (err) {
        vscode.window.showErrorMessage(`Verto: ${err instanceof Error ? err.message : String(err)}`)
        return false
      }
      continue
    }

    if (pick.action === 'repo' && pick.repoName) {
      selected = { kind: 'repo', name: pick.repoName }
    } else if (pick.action === 'project' && pick.projectNumber != null) {
      selected = { kind: 'project', number: pick.projectNumber }
    }
  }

  const identity: VertoConfig = {
    adapter: 'github',
    github:
      selected.kind === 'repo'
        ? {
            scope: 'repository',
            owner,
            ownerType,
            repository: selected.name,
          }
        : {
            scope: 'project',
            owner,
            ownerType,
            projectNumber: selected.number,
          },
  }

  const fileExisted = exists
  try {
    if (!fileExisted) {
      if (identity.github?.scope === 'repository') {
        await mkdir(path.dirname(cfgPath), { recursive: true })
        const template = `${buildWizardConfigComments('repository')}{
  "adapter": "github",
  "github": {
    "scope": "repository",
    "owner": ${JSON.stringify(owner)},
    "ownerType": ${JSON.stringify(ownerType)},
    "repository": ${JSON.stringify(selected.kind === 'repo' ? selected.name : '')}
  }
}
`
        await writeFile(cfgPath, template, 'utf8')
      } else {
        await writeVertoConfigFile(cfgPath, identity)
      }
    } else {
      await mergeIntoJsoncFile(cfgPath, identity)
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      `Verto: Failed to write config — ${err instanceof Error ? err.message : String(err)}`,
    )
    return false
  }

  try {
    let seedRepoDefaults = true
    if (fileExisted) {
      try {
        const raw = await readVertoConfigRawFile(cfgPath)
        if (isWorkspaceSetupComplete(raw)) seedRepoDefaults = false
      } catch {
        // keep seedRepoDefaults true for repair paths
      }
    }

    const audit = await auditForWizard(token, identity, { seedRepoDefaults })
    for (const w of audit.warnings) {
      console.warn(`[verto setup] ${w}`)
    }
    await mergeIntoJsoncFile(cfgPath, audit.discovered)

    if (!fileExisted && identity.github?.scope === 'project') {
      const existing = await readFile(cfgPath, 'utf8')
      if (!existing.startsWith('//')) {
        await writeFile(cfgPath, buildWizardConfigComments('project') + existing, 'utf8')
      }
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Verto: Audit failed — ${err instanceof Error ? err.message : String(err)}`)
    return false
  }

  const doc = await vscode.workspace.openTextDocument(cfgPath)
  await vscode.window.showTextDocument(doc)
  return true
}
