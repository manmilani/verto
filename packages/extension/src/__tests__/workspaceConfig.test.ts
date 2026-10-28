import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadWorkspaceConfig, isRawConfigComplete } from '../host/workspaceConfig.js'
import { ConfigMissingError, ConfigIncompleteError, ConfigInvalidError } from '../host/configErrors.js'

describe('loadWorkspaceConfig', () => {
  let dir: string
  const write = async (text: string) => {
    await mkdir(join(dir, '.vscode'), { recursive: true })
    await writeFile(join(dir, '.vscode', 'verto.config.jsonc'), text, 'utf8')
  }

  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'verto-ws-config-')) })
  afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

  it('missing file → ConfigMissingError', async () => {
    await expect(loadWorkspaceConfig(dir)).rejects.toBeInstanceOf(ConfigMissingError)
  })

  it('missing or unknown adapter → ConfigIncompleteError (setup offered and auto-started)', async () => {
    await write('{}')
    await expect(loadWorkspaceConfig(dir)).rejects.toBeInstanceOf(ConfigIncompleteError)
    await write('{ "adapter": "jira" }')
    await expect(loadWorkspaceConfig(dir)).rejects.toThrow(/unknown adapter "jira"/)
  })

  it('github identity-only file is incomplete', async () => {
    await write('{ "adapter": "github", "github": { "scope": "project", "owner": "a", "projectNumber": 1 } }')
    await expect(loadWorkspaceConfig(dir)).rejects.toBeInstanceOf(ConfigIncompleteError)
  })

  it('{ "adapter": "fissue" } is complete and merges the fissue defaults', async () => {
    await write('{ "adapter": "fissue" }')
    const config = await loadWorkspaceConfig(dir)
    expect(config.fissue?.root).toBe('.')
    expect(config.fissue?.fieldMappings?.status).toEqual({ from: { kind: 'issueField', field: 'status' }, type: 'select' })
    expect(config.github).toBeUndefined()
  })

  it('an invalid fissue config is a plain error (no wizard to offer)', async () => {
    await write('{ "adapter": "fissue", "fissue": { "rooot": "x" } }')
    const err = await loadWorkspaceConfig(dir).catch(e => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(ConfigInvalidError)
    expect(err.message).toMatch(/edit the file/)
  })
})

describe('isRawConfigComplete', () => {
  it('github: its wizard rule; fissue: valid config; unknown: false', () => {
    expect(isRawConfigComplete({ adapter: 'github', github: { scope: 'project', owner: 'a', projectNumber: 1 } })).toBe(false)
    expect(isRawConfigComplete({ adapter: 'fissue' })).toBe(true)
    expect(isRawConfigComplete({ adapter: 'fissue', fissue: { bad: 1 } })).toBe(false)
    expect(isRawConfigComplete({ adapter: 'nope' })).toBe(false)
  })
})
