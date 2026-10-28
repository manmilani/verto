import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  writeVertoConfigFile,
  mergeIntoJsoncFile,
  readVertoConfigRawFile,
  isWorkspaceSetupComplete,
  insertFieldMappings,
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

  it('patches any adapter block the same way (fissue)', async () => {
    const path = join(dir, 'verto.config.jsonc')
    await writeVertoConfigFile(path, {
      adapter: 'fissue',
      fissue: { fieldMappings: { mine: { from: { kind: 'issueField', field: 'x' } } } },
    })
    await mergeIntoJsoncFile(path, {
      fissue: { root: 'sub', fieldMappings: { status: { from: { kind: 'issueField', field: 'status' } } } },
    })
    const parsed = parseVertoConfig(await readFile(path, 'utf8'))
    expect(parsed.fissue?.root).toBe('sub')
    expect(Object.keys(parsed.fissue?.fieldMappings ?? {}).sort()).toEqual(['mine', 'status'])
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

describe('insertFieldMappings', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'verto-config-insert-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const priority = { from: { kind: 'issueField', field: 'priority' }, type: 'number' }

  it('adds the entry, keeping comments and layout', async () => {
    const path = join(dir, 'verto.config.jsonc')
    const initial = `{
  // my adapter
  "adapter": "fissue",
  "fissue": {
    "root": "sub", // where tickets live
    "fieldMappings": {
      "status": { "from": { "kind": "issueField", "field": "status" } }
    }
  }
}
`
    await writeFile(path, initial, 'utf8')
    await insertFieldMappings(path, 'fissue', { priority })
    const text = await readFile(path, 'utf8')
    expect(text).toContain('// my adapter')
    expect(text).toContain('"root": "sub", // where tickets live')
    expect(text).toContain('"status": { "from": { "kind": "issueField", "field": "status" } },\n      "priority": {')
    expect(parseVertoConfig(text).fissue?.fieldMappings?.priority).toEqual(priority)
  })

  it('inserts into a file without the adapter block', async () => {
    const path = join(dir, 'verto.config.jsonc')
    await writeFile(path, '{ "adapter": "fissue" }\n', 'utf8')
    await insertFieldMappings(path, 'fissue', { priority })
    expect(parseVertoConfig(await readFile(path, 'utf8')).fissue?.fieldMappings?.priority).toEqual(priority)
  })

  it('refuses to write an invalid result', async () => {
    const path = join(dir, 'verto.config.jsonc')
    await writeFile(path, '{ "adapter": "fissue" }\n', 'utf8')
    await expect(insertFieldMappings(path, 'fissue', { bad: { nope: 1 } })).rejects.toThrow()
    expect(await readFile(path, 'utf8')).toBe('{ "adapter": "fissue" }\n')
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
