import type { FissueApiV1, FissueProjectConfig, FissueProjectState, FissueStateTicket, FissueRaw } from '../system_types.js'

export const fissueConfig: FissueProjectConfig = {
  prefix: 'P',
  fields: {
    id: { type: 'text', isArray: false },
    title: { type: 'text', isArray: false },
    body: { type: 'text', isArray: false },
    state: { type: 'select', isArray: false, options: [{ name: 'OPEN' }, { name: 'CLOSED' }] },
    labels: { type: 'text', isArray: true },
    assignees: { type: 'text', isArray: true },
    issueType: { type: 'text', isArray: false },
    createdAt: { type: 'date', isArray: false },
    subIssues: { type: 'text', isArray: true },
    blockedBy: { type: 'text', isArray: true },
    status: { kind: 'issueField', type: 'select', isArray: false, options: [{ name: 'Todo' }, { name: 'In Progress' }, { name: 'Done' }] },
    points: { type: 'number', isArray: false },
  },
}

export function ticket(id: string, values: Record<string, FissueRaw> = {}, body = ''): FissueStateTicket {
  const file = `${id}-t.md`
  return { id, file, path: `/proj/.fissue/tickets/${file}`, values: { title: `T ${id}`, state: 'OPEN', ...values }, body }
}

export function state(tickets: FissueStateTicket[]): FissueProjectState {
  return { config: fissueConfig, tickets, warnings: [] }
}

export function fakeApi(s: FissueProjectState, root: string | null = '/proj'): FissueApiV1 & { calls: number } {
  const api = {
    apiVersion: 1,
    calls: 0,
    async projectState() {
      api.calls++
      return s
    },
    async findProjectRoot() {
      return root
    },
  }
  return api
}
