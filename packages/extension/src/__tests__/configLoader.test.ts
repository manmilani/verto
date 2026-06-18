import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { isWorkspaceSetupComplete } from '@verto/config'
import {
  ConfigMissingError,
  ConfigIncompleteError,
  ConfigInvalidError,
  isSetupRequiredConfigError,
  shouldAutoStartSetupForConfigError,
} from '../host/configErrors.js'

describe('isWorkspaceSetupComplete', () => {
  it('requires at least one fieldMappings key in workspace file', () => {
    expect(
      isWorkspaceSetupComplete({
        adapter: 'github',
        github: { scope: 'project', owner: 'a', projectNumber: 1 },
      }),
    ).toBe(false)
  })
})

describe('config error types', () => {
  it('isSetupRequiredConfigError identifies setup errors', () => {
    expect(isSetupRequiredConfigError(new ConfigMissingError())).toBe(true)
    expect(isSetupRequiredConfigError(new ConfigIncompleteError())).toBe(true)
    expect(isSetupRequiredConfigError(new Error('other'))).toBe(false)
  })

  it('shouldAutoStartSetupForConfigError excludes invalid config', () => {
    expect(shouldAutoStartSetupForConfigError(new ConfigMissingError())).toBe(true)
    expect(shouldAutoStartSetupForConfigError(new ConfigIncompleteError())).toBe(true)
    expect(shouldAutoStartSetupForConfigError(new ConfigInvalidError('bad'))).toBe(false)
  })
})

describe('configLoader integration', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'verto-config-loader-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('identity-only file is incomplete', async () => {
    await mkdir(join(dir, '.vscode'), { recursive: true })
    const content = `{
  "adapter": "github",
  "github": { "scope": "project", "owner": "acme", "projectNumber": 1 }
}`
    await writeFile(join(dir, '.vscode', 'verto.config.jsonc'), content, 'utf8')
    const raw = JSON.parse(content)
    expect(isWorkspaceSetupComplete(raw)).toBe(false)
  })
})
