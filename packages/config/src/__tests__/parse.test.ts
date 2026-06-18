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
    expect(config.github!.owner).toBe('owner')
  })

  it('throws on invalid config (missing required field)', () => {
    const jsonc = `{ "adapter": "github", "github": { "scope": "project", "owner": "x" } }`
    expect(() => parseVertoConfig(jsonc)).toThrow(/projectNumber/)
  })

  it('throws on malformed JSON', () => {
    expect(() => parseVertoConfig('{ broken json')).toThrow()
  })

  it('parses non-github adapter without github block', () => {
    const config = parseVertoConfig('{ "adapter": "beans" }')
    expect(config.adapter).toBe('beans')
    expect(config.github).toBeUndefined()
  })

  it('throws when github adapter omits github block', () => {
    expect(() => parseVertoConfig('{ "adapter": "github" }')).toThrow()
  })

  it('parses valid ui.displayStatusGroups', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: { scope: 'project', owner: 'owner', projectNumber: 1 },
      ui: {
        displayStatusGroups: [
          { label: 'Done', sources: { ticket: { isDone: true }, parsed: { isDone: true } } },
          { label: 'In Progress', sources: { ticket: { isDone: false, statuses: ['In Progress'] } } },
          { label: 'Raw', sources: { parsed: { isDone: false, statuses: ['raw'] } } },
        ],
      },
    })
    const config = parseVertoConfig(jsonc)
    expect(config.ui?.displayStatusGroups).toHaveLength(3)
    expect(config.ui?.displayStatusGroups![0].label).toBe('Done')
    expect(config.ui?.displayStatusGroups![0].sources.ticket?.isDone).toBe(true)
    expect(config.ui?.displayStatusGroups![2].sources.parsed?.statuses).toEqual(['raw'])
  })

  it('throws on invalid displayStatusGroups shape (missing label)', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: { scope: 'project', owner: 'owner', projectNumber: 1 },
      ui: {
        displayStatusGroups: [{ sources: { ticket: { isDone: true } } }],
      },
    })
    expect(() => parseVertoConfig(jsonc)).toThrow(/label/)
  })

  it('throws on displayStatusGroups column with empty sources object', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: { scope: 'project', owner: 'owner', projectNumber: 1 },
      ui: {
        displayStatusGroups: [{ label: 'Empty', sources: {} }],
      },
    })
    expect(() => parseVertoConfig(jsonc)).toThrow()
  })

  it('config without ui is valid (optional field)', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: { scope: 'project', owner: 'owner', projectNumber: 1 },
    })
    const config = parseVertoConfig(jsonc)
    expect(config.ui).toBeUndefined()
  })

  it('rejects empty string in statuses list', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: { scope: 'project', owner: 'owner', projectNumber: 1 },
      ui: {
        displayStatusGroups: [
          { label: 'Bad', sources: { ticket: { statuses: [''] } } },
        ],
      },
    })
    expect(() => parseVertoConfig(jsonc)).toThrow()
  })
})
