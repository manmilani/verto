import { describe, it, expect } from 'vitest'
import type { FieldMappings } from '@verto/config'
import {
  buildIssueSelection,
  ISSUE_FIELD_VALUES_SELECTION,
  issuePropertySelection,
  SYSTEM_ISSUE_SELECTION,
} from '../issue_selection.js'
import { ISSUE_FIELD_RESOLVER } from '../project_fields.js'
import { githubAdapterDefaults } from '../defaults.js'

const lines = (fm: FieldMappings) => buildIssueSelection(fm).selection.split('\n')

describe('buildIssueSelection', () => {
  it('always has the system part; nothing else without mappings', () => {
    expect(buildIssueSelection().selection).toBe(SYSTEM_ISSUE_SELECTION.join('\n'))
    expect(buildIssueSelection().paginated).toEqual(['subIssues', 'blockedBy', 'blocking'])
  })

  it('adds each kind:issue base name once: reader selections, bare names otherwise', () => {
    const sel = lines({
      type: { from: { kind: 'issue', field: 'type' } },
      kind: { from: { kind: 'issue', field: 'type' } },
      locked: { from: { kind: 'issue', field: 'locked' } },
      personas: { from: { kind: 'issue', field: 'labels.persona' } },
      phase: { from: { kind: 'issue', field: 'body.PHASE' } },
    })
    expect(sel.filter(s => s === 'issueType { name }')).toHaveLength(1)
    expect(sel).toContain('locked')
    expect(buildIssueSelection({ c: { from: { kind: 'issue', field: 'constructor' } } }).selection).toContain('\nconstructor')
    expect(sel).toContain('body')
    expect(sel.filter(s => s.startsWith('labels('))).toHaveLength(1)
  })

  it('never sends a name that is not a GraphQL name', () => {
    expect(issuePropertySelection('Target date')).toBeUndefined()
    expect(lines({ x: { from: { kind: 'issue', field: 'Target date' } } })).toEqual([...SYSTEM_ISSUE_SELECTION])
  })

  it('adds issueFieldValues only when an issueField is mapped', () => {
    const sel = (kind: 'projectV2' | 'issueField') => buildIssueSelection({ p: { from: { kind, field: 'Priority' } } }).selection
    expect(sel('projectV2')).not.toContain(ISSUE_FIELD_VALUES_SELECTION)
    expect(sel('issueField')).toContain(ISSUE_FIELD_VALUES_SELECTION)
  })

  it('the default config still selects every property the old fixed selection had, except unused number (AC 9)', () => {
    const fieldMappings = githubAdapterDefaults.github!.fieldMappings!
    const sel = lines(fieldMappings)
    for (const s of ['body', 'stateReason', 'updatedAt', 'issueType { name }', 'assignees(first: 20) { nodes { login } }', 'milestone { title }']) {
      expect(sel).toContain(s)
    }
  })

  it('relatesTo is followed past its first page', () => {
    expect(buildIssueSelection({ r: { from: { kind: 'issue', field: 'relatesTo' } } }).paginated).toContain('relatesTo')
  })

  it('system and reader selections never share a response name with a different shape', () => {
    const responseName = (s: string) => /^[A-Za-z_]\w*/.exec(s)![0]
    const all = [...SYSTEM_ISSUE_SELECTION, ...Object.values(ISSUE_FIELD_RESOLVER).map(r => r.select)]
    const byName = new Map<string, Set<string>>()
    for (const s of all) byName.set(responseName(s), (byName.get(responseName(s)) ?? new Set()).add(s))
    for (const [, shapes] of byName) expect(shapes.size).toBe(1)
  })
})
