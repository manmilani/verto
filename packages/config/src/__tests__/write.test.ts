import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  writeVertoConfigFile,
  mergeIntoJsoncFile,
  readVertoConfigRawFile,
  isWorkspaceSetupComplete,
} from '../write.js'
import { parseVertoConfig } from '../parse.js'
import type { VertoConfig } from '../types.js'

describe('writeVertoConfigFile / mergeIntoJsoncFile', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'verto-config-write-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('writeVertoConfigFile round-trips through parseVertoConfig', async () => {
    const path = join(dir, 'verto.config.jsonc')
    const config: VertoConfig = {
      adapter: 'github',
      github: {
        scope: 'project',
        owner: 'acme',
        projectNumber: 3,
        fieldMappings: {
          status: { from: { kind: 'projectV2', field: 'Status' }, type: 'select' },
        },
      },
    }
    await writeVertoConfigFile(path, config)
    const parsed = parseVertoConfig(await readFile(path, 'utf8'))
    expect(parsed).toEqual(config)
  })

  it('mergeIntoJsoncFile preserves leading header comments', async () => {
    const path = join(dir, 'verto.config.jsonc')
    const initial = `// keep this comment
{
  "adapter": "github",
  "github": {
    "scope": "project",
    "owner": "acme",
    "projectNumber": 1,
    "fieldMappings": {
      "status": { "from": { "kind": "projectV2", "field": "Status" }, "type": "select" },
      "custom_field": { "from": { "kind": "projectV2", "field": "Custom" } }
    }
  }
}
`
    await writeFile(path, initial, 'utf8')

    await mergeIntoJsoncFile(path, {
      github: {
        scope: 'project',
        owner: 'acme',
        projectNumber: 2,
        fieldMappings: {
          status: { from: { kind: 'projectV2', field: 'Status' }, type: 'select' },
        },
      },
    })

    const text = await readFile(path, 'utf8')
    expect(text).toContain('keep this comment')
    expect(text).toContain('custom_field')
    const parsed = parseVertoConfig(text)
    if (parsed.github?.scope === 'project') {
      expect(parsed.github.projectNumber).toBe(2)
    }
  })

  it('re-run step 4 identity patch leaves fieldMappings intact', async () => {
    const path = join(dir, 'verto.config.jsonc')
    await writeVertoConfigFile(path, {
      adapter: 'github',
      github: {
        scope: 'repository',
        owner: 'acme',
        repository: 'app',
        fieldMappings: {
          type: { from: { kind: 'issue', field: 'type' } },
          user_added: { from: { kind: 'issue', field: 'labels' } },
        },
      },
    })

    await mergeIntoJsoncFile(path, {
      adapter: 'github',
      github: {
        scope: 'repository',
        owner: 'acme',
        repository: 'other-repo',
        ownerType: 'organization',
      },
    })

    const raw = await readVertoConfigRawFile(path)
    const github = raw.github as Record<string, unknown>
    expect(github.repository).toBe('other-repo')
    expect(github.ownerType).toBe('organization')
    const mappings = github.fieldMappings as Record<string, unknown>
    expect(mappings.user_added).toBeDefined()
    expect(mappings.type).toBeDefined()
  })

  it('re-run step 5 patch updates audit keys but preserves user-added fieldMappings keys', async () => {
    const path = join(dir, 'verto.config.jsonc')
    await writeVertoConfigFile(path, {
      adapter: 'github',
      github: {
        scope: 'project',
        owner: 'acme',
        projectNumber: 1,
        fieldMappings: {
          status: { from: { kind: 'projectV2', field: 'Status' }, type: 'select' },
          user_added: { from: { kind: 'issue', field: 'labels' } },
        },
      },
    })

    await mergeIntoJsoncFile(path, {
      github: {
        scope: 'project',
        owner: 'acme',
        projectNumber: 1,
        fieldMappings: {
          priority: { from: { kind: 'projectV2', field: 'Priority' }, type: 'select' },
        },
      },
    })

    const parsed = parseVertoConfig(await readFile(path, 'utf8'))
    expect(parsed.github?.fieldMappings?.priority).toBeDefined()
    expect(parsed.github?.fieldMappings?.user_added).toBeDefined()
  })

  it('writes fieldMappings entries on a single line each', async () => {
    const path = join(dir, 'verto.config.jsonc')
    await writeVertoConfigFile(path, {
      adapter: 'github',
      github: {
        scope: 'project',
        owner: 'acme',
        projectNumber: 1,
        fieldMappings: {
          status: { from: { kind: 'projectV2', field: 'Status' }, type: 'select' },
          type: { from: { kind: 'issue', field: 'type' } },
        },
      },
      ui: {
        displayStatusGroups: [
          { label: 'Raw', sources: { parsed: { statuses: ['raw'] } } },
        ],
      },
    })
    const text = await readFile(path, 'utf8')
    expect(text).toContain('"status": {"from":{"kind":"projectV2","field":"Status"},"type":"select"}')
    expect(text).toContain('{"label":"Raw","sources":')
    expect(text).toContain('System-reserved display group "Done"')
  })
})

describe('isWorkspaceSetupComplete', () => {
  it('false when fieldMappings missing or empty', () => {
    expect(isWorkspaceSetupComplete({ adapter: 'github', github: { scope: 'project', owner: 'a', projectNumber: 1 } })).toBe(false)
    expect(isWorkspaceSetupComplete({ adapter: 'github', github: { fieldMappings: {} } })).toBe(false)
  })

  it('true when fieldMappings has at least one key', () => {
    expect(
      isWorkspaceSetupComplete({
        adapter: 'github',
        github: { fieldMappings: { status: { from: { kind: 'projectV2', field: 'Status' } } } },
      }),
    ).toBe(true)
  })
})
