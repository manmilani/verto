import { describe, it, expect } from 'vitest'
import { parseVertoConfig } from '../parse.js'

describe('parseVertoConfig', () => {
  it('parses valid JSONC with line comments', () => {
    const jsonc = `{
      // adapter config
      "adapter": "github",
      "github": {
        "scope": "project", // project scope
        "owner": "owner",
        "projectNumber": 1
      }
    }`
    const config = parseVertoConfig(jsonc)
    expect(config.adapter).toBe('github')
    expect(config.github.owner).toBe('owner')
  })

  it('throws on invalid config (missing required field)', () => {
    const jsonc = `{ "adapter": "github", "github": { "scope": "project", "owner": "x" } }`
    expect(() => parseVertoConfig(jsonc)).toThrow(/projectNumber/)
  })

  it('throws on malformed JSON', () => {
    expect(() => parseVertoConfig('{ broken json')).toThrow()
  })
})
