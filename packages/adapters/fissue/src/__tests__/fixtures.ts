import type { FissueApiV1, FissueProjectConfig, FissueProjectState, FissueStateTicket, FissueRaw, FissueUpdateInput, FissueInput } from '../system_types.js'

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
    parent: { type: 'text', isArray: false },
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

export interface FakeApi extends FissueApiV1 {
  calls: number
  updates: { ref: string; input: FissueUpdateInput }[]
  creates: Record<string, FissueInput>[]
  added: { name: string; def: Record<string, unknown> }[]
}

/** An in-memory fissue API; write calls are recorded (and `created` tickets added to the state). */
export function fakeApi(s: FissueProjectState, root: string | null = '/proj'): FakeApi {
  let next = 100
  const api: FakeApi = {
    apiVersion: 1,
    calls: 0,
    updates: [],
    creates: [],
    added: [],
    async projectState() {
      api.calls++
      return s
    },
    async findProjectRoot() {
      return root
    },
    async updateTicket(_root, ref, input) {
      api.updates.push({ ref, input })
      return { id: ref, changed: true }
    },
    async createTicket(_root, values) {
      api.creates.push(values)
      const id = `P-${next++}`
      s.tickets.push(ticket(id, { title: values['title'] as string, parent: values['parent'] as string }))
      return { id }
    },
    async addField(_root, name, def) {
      api.added.push({ name, def })
      return { changed: true }
    },
  }
  return api
}
