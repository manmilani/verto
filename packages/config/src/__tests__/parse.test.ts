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

  it('parses valid portfolioColumns at config root', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: { scope: 'project', owner: 'owner', projectNumber: 1 },
      portfolioColumns: [
        { label: 'Done', sources: { ticket: { isDone: true }, parsed: { isDone: true } } },
        { label: 'In Progress', sources: { ticket: { isDone: false, statuses: ['In Progress'] } } },
        { label: 'Raw', sources: { parsed: { isDone: false, statuses: ['raw'] } } },
      ],
    })
    const config = parseVertoConfig(jsonc)
    expect(config.portfolioColumns).toHaveLength(3)
    expect(config.portfolioColumns![0].label).toBe('Done')
    expect(config.portfolioColumns![0].sources.ticket?.isDone).toBe(true)
    expect(config.portfolioColumns![2].sources.parsed?.statuses).toEqual(['raw'])
  })

  it('throws on invalid portfolioColumns shape (missing label)', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: { scope: 'project', owner: 'owner', projectNumber: 1 },
      portfolioColumns: [{ sources: { ticket: { isDone: true } } }],
    })
    expect(() => parseVertoConfig(jsonc)).toThrow(/label/)
  })

  it('throws on portfolioColumns column with empty sources object', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: { scope: 'project', owner: 'owner', projectNumber: 1 },
      portfolioColumns: [{ label: 'Empty', sources: {} }],
    })
    expect(() => parseVertoConfig(jsonc)).toThrow()
  })

  it('config without portfolioColumns is valid (optional field)', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: { scope: 'project', owner: 'owner', projectNumber: 1 },
    })
    const config = parseVertoConfig(jsonc)
    expect(config.portfolioColumns).toBeUndefined()
  })
})
