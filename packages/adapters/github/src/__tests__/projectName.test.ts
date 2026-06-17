import { describe, it, expect } from 'vitest'
import type { VertoConfig } from '@verto/config'
import { resolveProjectName } from '../projectName.js'

describe('resolveProjectName', () => {
  it('returns repository name in repository scope', async () => {
    const config: VertoConfig = {
      adapter: 'github',
      github: { scope: 'repository', owner: 'acme', repository: 'my-app' },
    }
    await expect(resolveProjectName(config, 'token')).resolves.toBe('my-app')
  })
})
