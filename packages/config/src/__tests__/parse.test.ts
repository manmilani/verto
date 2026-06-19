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
          { label: 'In Progress', sources: { ticket: { statuses: ['In Progress'] } } },
          { label: 'Raw', sources: { parsed: { statuses: ['raw'] } } },
        ],
      },
    })
    const config = parseVertoConfig(jsonc)
    expect(config.ui?.displayStatusGroups).toHaveLength(2)
    expect(config.ui?.displayStatusGroups![0].label).toBe('In Progress')
    expect(config.ui?.displayStatusGroups![1].sources.parsed?.statuses).toEqual(['raw'])
  })

  it('rejects reserved Done label in displayStatusGroups', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: { scope: 'project', owner: 'owner', projectNumber: 1 },
      ui: {
        displayStatusGroups: [
          { label: 'Done', sources: { ticket: { statuses: ['Closed'] } } },
        ],
      },
    })
    expect(() => parseVertoConfig(jsonc)).toThrow(/system-reserved/i)
  })

  it('rejects reserved others label in displayStatusGroups', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: { scope: 'project', owner: 'owner', projectNumber: 1 },
      ui: {
        displayStatusGroups: [
          { label: 'others', sources: { ticket: { statuses: ['Backlog'] } } },
        ],
      },
    })
    expect(() => parseVertoConfig(jsonc)).toThrow(/system-reserved/i)
  })

  it('throws on invalid displayStatusGroups shape (missing label)', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: { scope: 'project', owner: 'owner', projectNumber: 1 },
      ui: {
        displayStatusGroups: [{ sources: { ticket: { statuses: ['Open'] } } }],
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

  it('rejects isArray:true combined with type:"boolean"', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: {
        scope: 'project', owner: 'owner', projectNumber: 1,
        fieldMappings: {
          isBackend: { from: { kind: 'issue', field: 'labels.backend' }, type: 'boolean', isArray: true },
        },
      },
    })
    expect(() => parseVertoConfig(jsonc)).toThrow(/isArray.*boolean|boolean.*isArray/i)
  })

  it('accepts isArray:true combined with type:"text"', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: {
        scope: 'project', owner: 'owner', projectNumber: 1,
        fieldMappings: {
          tags: { from: { kind: 'issue', field: 'labels.tag' }, type: 'text', isArray: true },
        },
      },
    })
    expect(() => parseVertoConfig(jsonc)).not.toThrow()
  })

  it('accepts type:"boolean" alone (no isArray)', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: {
        scope: 'project', owner: 'owner', projectNumber: 1,
        fieldMappings: {
          isBackend: { from: { kind: 'issue', field: 'labels.backend' }, type: 'boolean' },
        },
      },
    })
    expect(() => parseVertoConfig(jsonc)).not.toThrow()
  })

  it('accepts isArray on a non-dot entry (silently ignored)', () => {
    const jsonc = JSON.stringify({
      adapter: 'github',
      github: {
        scope: 'project', owner: 'owner', projectNumber: 1,
        fieldMappings: {
          labels: { from: { kind: 'issue', field: 'labels' }, isArray: true },
        },
      },
    })
    expect(() => parseVertoConfig(jsonc)).not.toThrow()
  })
})
