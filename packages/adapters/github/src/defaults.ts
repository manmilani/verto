import type { VertoConfig } from '@verto/config'

export const githubAdapterDefaults: VertoConfig = {
  adapter: 'github',

  ui: {
    displayStatusGroups: [
      { label: 'Raw', sources: { parsed: { statuses: ['raw'] } } },
    ],
  },

  github: {
    scope: 'project',
    owner: 'YOUR_OWNER',
    projectNumber: 0,

    fieldMappings: {
      type:        { from: { kind: 'issue',     field: 'type' } },
      assignee:    { from: { kind: 'issue',     field: 'assignee' } },
      labels:      { from: { kind: 'issue',     field: 'labels' } },
      body:        { from: { kind: 'issue',     field: 'body' } },
      stateReason: { from: { kind: 'issue',     field: 'stateReason' } },
      updated_at:  { from: { kind: 'issue',     field: 'updated_at' } },
      milestone:   { from: { kind: 'issue',     field: 'milestone' } },
      status:      { from: { kind: 'projectV2', field: 'Status' }, type: 'select' },
      personas:    { from: { kind: 'issue',     field: 'labels.persona' }, isArray: true },
    },
  },
}
