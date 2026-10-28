import type { VertoConfig } from '@verto/config'

export const fissueAdapterDefaults: VertoConfig = {
  adapter: 'fissue',

  ui: {
    displayStatusGroups: [
      { label: 'In Progress', sources: { ticket: { statuses: ['In Progress'] } } },
      { label: 'Raw', sources: { ticket: { statuses: ['Todo'] }, parsed: { statuses: ['raw'] } } },
    ],
  },

  fissue: {
    root: '.',

    fieldMappings: {
      type:        { from: { kind: 'issue',      field: 'issueType' } },
      assignees:   { from: { kind: 'issue',      field: 'assignees' } },
      labels:      { from: { kind: 'issue',      field: 'labels' } },
      body:        { from: { kind: 'issue',      field: 'body' } },
      stateReason: { from: { kind: 'issue',      field: 'stateReason' } },
      updated_at:  { from: { kind: 'issue',      field: 'updatedAt' } },
      milestone:   { from: { kind: 'issue',      field: 'milestone' } },
      status:      { from: { kind: 'issueField', field: 'status' }, type: 'select' },
      personas:    { from: { kind: 'issue',      field: 'labels.persona' }, isArray: true },
    },
  },
}
