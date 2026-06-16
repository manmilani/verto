import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SystemFieldAccessor, ProjectFieldAccessor } from '../project_fields.js'
import type { GitHubIssue, GitHubProjectV2Item } from '../system_types.js'
import type { FieldMappings } from '@verto/config'

function makeIssue(overrides: Partial<GitHubIssue> = {}): GitHubIssue {
  return {
    id: 'I1',
    number: 1,
    title: 'Test Issue',
    body: 'body text',
    closed: false,
    stateReason: null,
    url: 'https://github.com/test/issues/1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
    issueType: null,
    labels: { nodes: [] },
    assignees: { nodes: [] },
    milestone: null,
    parent: null,
    subIssues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    blockedBy: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    blocking: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    ...overrides,
  }
}

describe('SystemFieldAccessor', () => {
  const sys = new SystemFieldAccessor()

  it('maps required fields correctly', () => {
    const issue = makeIssue({ id: 'X1', title: 'My Issue', closed: true, parent: null })
    const fields = sys.toVertoNodeFields(issue)
    expect(fields.id).toBe('X1')
    expect(fields.title).toBe('My Issue')
    expect(fields.isDone).toBe(true)
    expect(fields.isDeliverySlice).toBe(true)
    expect(fields.ticketUrl).toBe(issue.url)
    expect(fields.created_at).toBe('2024-01-01T00:00:00Z')
  })

  it('isDeliverySlice is false when issue has a parent', () => {
    const issue = makeIssue({ parent: { id: 'P1' } })
    expect(sys.toVertoNodeFields(issue).isDeliverySlice).toBe(false)
  })

  it('prereqIds = blockedBy + subIssues deduplicated', () => {
    const issue = makeIssue({
      blockedBy: { nodes: [{ id: 'A' }, { id: 'B' }], pageInfo: { hasNextPage: false, endCursor: null } },
      subIssues: { nodes: [{ id: 'B' }, { id: 'C' }], pageInfo: { hasNextPage: false, endCursor: null } },
    })
    const fields = sys.toVertoNodeFields(issue)
    expect(fields.prereqIds).toEqual(['A', 'B', 'C'])
    expect(fields.childIds).toEqual(['B', 'C'])
  })
})

describe('ProjectFieldAccessor', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { warnSpy.mockRestore() })

  it('resolves kind:issue fields via resolver table', () => {
    const mappings: FieldMappings = {
      type: { from: { kind: 'issue', field: 'type' } },
      assignee: { from: { kind: 'issue', field: 'assignee' } },
      created_at: { from: { kind: 'issue', field: 'created_at' } },
    }
    const issue = makeIssue({
      issueType: { name: 'Bug' },
      assignees: { nodes: [{ login: 'alice' }, { login: 'bob' }] },
    })
    const pfa = new ProjectFieldAccessor(mappings, 'project')
    const fields = pfa.toVertoNodeFields(issue)
    expect(fields.ticketFields!['type']).toBe('Bug')
    expect(fields.ticketFields!['assignee']).toBe('alice')
    expect(fields.created_at).toBe('2024-01-01T00:00:00Z')
    expect(fields.ticketFields?.['created_at']).toBeUndefined()
  })

  it('resolves kind:projectV2 field case-insensitively; status routes to node root (canonical)', () => {
    const mappings: FieldMappings = {
      status: { from: { kind: 'projectV2', field: 'status' } },
    }
    const issue = makeIssue()
    const item: GitHubProjectV2Item = {
      issueNodeId: issue.id,
      fieldValues: [{ fieldName: 'Status', kind: 'single_select', value: 'In Progress' }],
    }
    const pfa = new ProjectFieldAccessor(mappings, 'project')
    const fields = pfa.toVertoNodeFields(issue, item)
    expect(fields.status).toBe('In Progress')
    expect(fields.ticketFields?.['status']).toBeUndefined()
  })

  it('applies values map for single_select priority', () => {
    const mappings: FieldMappings = {
      priority: {
        from: { kind: 'projectV2', field: 'Priority' },
        type: 'select',
        values: { High: 3, Medium: 5, Low: 7 },
      },
    }
    const issue = makeIssue()
    const item: GitHubProjectV2Item = {
      issueNodeId: issue.id,
      fieldValues: [{ fieldName: 'Priority', kind: 'single_select', value: 'High' }],
    }
    const pfa = new ProjectFieldAccessor(mappings, 'project')
    const fields = pfa.toVertoNodeFields(issue, item)
    expect(fields.priority).toBe(3)
  })

  it('uses number value directly for priority and clamps to [1,9]', () => {
    const mappings: FieldMappings = {
      priority: { from: { kind: 'projectV2', field: 'Priority' }, type: 'number' },
    }
    const issue = makeIssue()
    const item: GitHubProjectV2Item = {
      issueNodeId: issue.id,
      fieldValues: [{ fieldName: 'Priority', kind: 'number', value: 15 }],
    }
    const pfa = new ProjectFieldAccessor(mappings, 'project')
    const fields = pfa.toVertoNodeFields(issue, item)
    expect(fields.priority).toBe(9)
  })

  it('defaults priority to 5 and warns when no mapping configured', () => {
    const pfa = new ProjectFieldAccessor({}, 'project')
    const fields = pfa.toVertoNodeFields(makeIssue())
    expect(fields.priority).toBe(5)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no priority mapping'))
  })

  it('warns "field empty or unmapped" when priority mapping exists but projectV2 field is absent from item', () => {
    const mappings: FieldMappings = {
      priority: { from: { kind: 'projectV2', field: 'Priority' } },
    }
    const issue = makeIssue()
    const item: GitHubProjectV2Item = {
      issueNodeId: issue.id,
      fieldValues: [],  // Priority field not present on this item
    }
    const pfa = new ProjectFieldAccessor(mappings, 'project')
    const fields = pfa.toVertoNodeFields(issue, item)
    expect(fields.priority).toBe(5)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('field is empty or unmapped'))
  })

  it('skips projectV2 entries with warning in repository scope', () => {
    const mappings: FieldMappings = {
      status: { from: { kind: 'projectV2', field: 'Status' } },
    }
    const pfa = new ProjectFieldAccessor(mappings, 'repository')
    pfa.toVertoNodeFields(makeIssue())
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("'projectV2' unavailable in repository scope"))
  })

  it('coerces text field to number when type: "number" is declared', () => {
    const mappings: FieldMappings = {
      ai_tokens_estimate: { from: { kind: 'projectV2', field: 'ai_tokens_estimate' }, type: 'number' },
    }
    const issue = makeIssue()
    const item: GitHubProjectV2Item = {
      issueNodeId: issue.id,
      fieldValues: [{ fieldName: 'ai_tokens_estimate', kind: 'text', value: '1500' }],
    }
    const pfa = new ProjectFieldAccessor(mappings, 'project')
    const fields = pfa.toVertoNodeFields(issue, item)
    expect(fields.ticketFields!['ai_tokens_estimate']).toBe(1500)
  })

  it('returns null for non-numeric string when type: "number" is declared', () => {
    const mappings: FieldMappings = {
      score: { from: { kind: 'projectV2', field: 'Score' }, type: 'number' },
    }
    const issue = makeIssue()
    const item: GitHubProjectV2Item = {
      issueNodeId: issue.id,
      fieldValues: [{ fieldName: 'Score', kind: 'text', value: 'n/a' }],
    }
    const pfa = new ProjectFieldAccessor(mappings, 'project')
    const fields = pfa.toVertoNodeFields(issue, item)
    expect(fields.ticketFields!['score']).toBeNull()
  })

  it('routes canonical key to node root and non-canonical to ticketFields', () => {
    const mappings: FieldMappings = {
      isDone: { from: { kind: 'projectV2', field: 'Status' }, type: 'select', values: { Done: true, Open: false } },
      my_custom: { from: { kind: 'issue', field: 'body' } },
    }
    const issue = makeIssue()
    const item: GitHubProjectV2Item = {
      issueNodeId: issue.id,
      fieldValues: [{ fieldName: 'Status', kind: 'single_select', value: 'Done' }],
    }
    const pfa = new ProjectFieldAccessor(mappings, 'project')
    const fields = pfa.toVertoNodeFields(issue, item)
    expect(fields.isDone).toBe(true)
    expect(fields.ticketFields!['my_custom']).toBe('body text')
  })
})
