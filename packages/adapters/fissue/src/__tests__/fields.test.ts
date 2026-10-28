import { describe, it, expect } from 'vitest'
import { checkFieldsAgainst } from '../fields.js'
import { fissueConfig } from './fixtures.js'

describe('checkFieldsAgainst', () => {
  it('missing by name, projectV2 unsupported, kind mismatch accepted, dot entries by base field', () => {
    const out = checkFieldsAgainst({
      status: { from: { kind: 'issue', field: 'status' } },
      labels: { from: { kind: 'issueField', field: 'labels' } },
      gone: { from: { kind: 'issueField', field: 'priority' } },
      board: { from: { kind: 'projectV2', field: 'Status' } },
      personas: { from: { kind: 'issue', field: 'labels.persona' } },
      phase: { from: { kind: 'issue', field: 'notes.PHASE' } },
    }, fissueConfig, '/proj/.fissue/config.json')
    expect(out).toEqual([
      { key: 'gone', field: 'priority', kind: 'issueField', scope: '/proj/.fissue/config.json', reason: 'missing', suggestedKinds: [] },
      { key: 'board', field: 'Status', kind: 'projectV2', scope: '/proj/.fissue/config.json', reason: 'unsupported', suggestedKinds: [] },
      { key: 'phase', field: 'notes.PHASE', kind: 'issue', scope: '/proj/.fissue/config.json', reason: 'missing', suggestedKinds: [] },
    ])
  })
})
