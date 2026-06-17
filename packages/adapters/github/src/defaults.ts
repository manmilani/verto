import type { VertoConfig } from '@verto/config'

export const githubAdapterDefaults: VertoConfig = {
  adapter: 'github',

  ui: {
    displayStatusGroups: [
      { label: 'Done',        sources: { ticket: { isDone: true },  parsed: { isDone: true } } },
      { label: 'In Progress', sources: { ticket: { isDone: false, statuses: ['In Progress'] } } },
      { label: 'Raw',         sources: { parsed:  { isDone: false, statuses: ['raw'] } } },
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
    },
  },
}
