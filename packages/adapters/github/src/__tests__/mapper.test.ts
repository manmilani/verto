import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mapIssuesToGraph } from '../mapper.js'
import { validateGraph } from '@verto/core'
import type { GitHubIssue } from '../system_types.js'
import type { VertoConfig } from '@verto/config'

function makeIssue(id: string, overrides: Partial<GitHubIssue> = {}): GitHubIssue {
  return {
    id,
    number: 1,
    title: id,
    body: null,
    closed: false,
    stateReason: null,
    url: `https://github.com/issues/${id}`,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
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

const baseConfig: VertoConfig = {
  adapter: 'github',
  github: { scope: 'project', owner: 'test', projectNumber: 1 },
}

describe('mapIssuesToGraph', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { warnSpy.mockRestore() })

  it('blocking chain: A blocks B blocks C — correct prereqIds and edges', () => {
    const A = makeIssue('A')
    const B = makeIssue('B', { blockedBy: { nodes: [{ id: 'A' }], pageInfo: { hasNextPage: false, endCursor: null } } })
    const C = makeIssue('C', { blockedBy: { nodes: [{ id: 'B' }], pageInfo: { hasNextPage: false, endCursor: null } } })
    const graph = mapIssuesToGraph([A, B, C], new Map(), baseConfig)

    const bNode = graph.nodes.find(n => n.id === 'B')!
    expect(bNode.prereqIds).toEqual(['A'])
    const cNode = graph.nodes.find(n => n.id === 'C')!
    expect(cNode.prereqIds).toEqual(['B'])

    expect(graph.edges).toContainEqual({ from: 'A', to: 'B', reason: 'blocking' })
    expect(graph.edges).toContainEqual({ from: 'B', to: 'C', reason: 'blocking' })

    const result = validateGraph(graph)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('parent/child: P.prereqIds = [B,C]; B/C.prereqIds = []; edges are parent-child', () => {
    const B = makeIssue('B', { parent: { id: 'P' } })
    const C = makeIssue('C', { parent: { id: 'P' } })
    const P = makeIssue('P', {
      subIssues: { nodes: [{ id: 'B' }, { id: 'C' }], pageInfo: { hasNextPage: false, endCursor: null } },
    })
    const graph = mapIssuesToGraph([P, B, C], new Map(), baseConfig)

    const pNode = graph.nodes.find(n => n.id === 'P')!
    expect(pNode.prereqIds).toEqual(['B', 'C'])
    expect(pNode.childIds).toEqual(['B', 'C'])

    const bNode = graph.nodes.find(n => n.id === 'B')!
    expect(bNode.prereqIds).toEqual([])

    expect(graph.edges).toContainEqual({ from: 'B', to: 'P', reason: 'parent-child' })
    expect(graph.edges).toContainEqual({ from: 'C', to: 'P', reason: 'parent-child' })

    const result = validateGraph(graph)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('top-level issue → isDeliverySlice=true; child with parent → false', () => {
    const P = makeIssue('P')
    const C = makeIssue('C', {
      parent: { id: 'P' },
      // P has C as sub-issue
    })
    const pOverride = makeIssue('P', {
      subIssues: { nodes: [{ id: 'C' }], pageInfo: { hasNextPage: false, endCursor: null } },
    })
    const graph = mapIssuesToGraph([pOverride, C], new Map(), baseConfig)
    expect(graph.nodes.find(n => n.id === 'P')!.isDeliverySlice).toBe(true)
    expect(graph.nodes.find(n => n.id === 'C')!.isDeliverySlice).toBe(false)
  })

  it('assignees coercion: first login → ticketFields.assignee', () => {
    const issue = makeIssue('A', {
      assignees: { nodes: [{ login: 'alice' }, { login: 'bob' }] },
    })
    const config: VertoConfig = {
      adapter: 'github',
      github: {
        scope: 'project', owner: 'test', projectNumber: 1,
        fieldMappings: {
          assignee: { from: { kind: 'issue', field: 'assignee' } },
        },
      },
    }
    const graph = mapIssuesToGraph([issue], new Map(), config)
    expect(graph.nodes[0].ticketFields!['assignee']).toBe('alice')
  })

  it('edge deduplication: issue both blockedBy A and sub-issue of A → two edges with distinct reasons', () => {
    const A = makeIssue('A', {
      subIssues: { nodes: [{ id: 'B' }], pageInfo: { hasNextPage: false, endCursor: null } },
    })
    const B = makeIssue('B', {
      parent: { id: 'A' },
      blockedBy: { nodes: [{ id: 'A' }], pageInfo: { hasNextPage: false, endCursor: null } },
    })
    const graph = mapIssuesToGraph([A, B], new Map(), baseConfig)
    const a_to_b_blocking = graph.edges.filter(e => e.from === 'A' && e.to === 'B' && e.reason === 'blocking')
    const b_to_a_parent = graph.edges.filter(e => e.from === 'B' && e.to === 'A' && e.reason === 'parent-child')
    expect(a_to_b_blocking).toHaveLength(1)
    expect(b_to_a_parent).toHaveLength(1)
  })

  it('prereqIds dedupe: same ID in both blockedBy and subIssues appears once', () => {
    const P = makeIssue('P', {
      blockedBy: { nodes: [{ id: 'X' }], pageInfo: { hasNextPage: false, endCursor: null } },
      subIssues: { nodes: [{ id: 'X' }], pageInfo: { hasNextPage: false, endCursor: null } },
    })
    const X = makeIssue('X')
    const graph = mapIssuesToGraph([P, X], new Map(), baseConfig)
    const pNode = graph.nodes.find(n => n.id === 'P')!
    expect(pNode.prereqIds).toEqual(['X'])
    expect(pNode.childIds).toEqual(['X'])
  })

  it('stamps nodeType: ticket, nodeOrigin: github, _rawReqIds: [] on all nodes', () => {
    const graph = mapIssuesToGraph([makeIssue('A')], new Map(), baseConfig)
    const n = graph.nodes[0]
    expect(n.nodeType).toBe('ticket')
    expect(n.nodeOrigin).toBe('github')
    expect(n._rawReqIds).toEqual([])
  })

  it('extracts personas from persona: labels when no fieldMappings.personas', () => {
    const issue = makeIssue('A', {
      labels: { nodes: [{ name: 'persona:admin' }, { name: 'persona:user' }, { name: 'bug' }] },
    })
    const graph = mapIssuesToGraph([issue], new Map(), baseConfig)
    expect(graph.nodes[0].personas).toEqual(['admin', 'user'])
  })

  it('personas from fieldMappings.personas (kind:issue, field:labels) overrides label extraction', () => {
    const config: VertoConfig = {
      adapter: 'github',
      github: {
        scope: 'project', owner: 'test', projectNumber: 1,
        fieldMappings: {
          personas: { from: { kind: 'issue', field: 'labels' } },
        },
      },
    }
    // Issue has both a persona: label and a plain label
    const issue = makeIssue('A', {
      labels: { nodes: [{ name: 'persona:admin' }, { name: 'bug' }] },
    })
    const graph = mapIssuesToGraph([issue], new Map(), config)
    const n = graph.nodes[0]
    // With fieldMappings.personas using plain 'labels' → ProjectFieldAccessor returns all label names (raw, unfiltered)
    // vs. default extraction which would return ['admin'] (only persona: labels, prefix stripped)
    expect(n.personas).toEqual(['persona:admin', 'bug'])
  })

  it('personas from dot-notation fieldMappings (labels.persona) → adapter sets personas:[] placeholder; text-parser fills it', () => {
    const config: VertoConfig = {
      adapter: 'github',
      github: {
        scope: 'project', owner: 'test', projectNumber: 1,
        fieldMappings: {
          labels:   { from: { kind: 'issue', field: 'labels' } },
          personas: { from: { kind: 'issue', field: 'labels.persona' } },
        },
      },
    }
    const issue = makeIssue('A', {
      labels: { nodes: [{ name: 'persona:admin' }, { name: 'bug' }] },
    })
    const graph = mapIssuesToGraph([issue], new Map(), config)
    const n = graph.nodes[0]
    // Adapter skips the dot-notation entry → personas placeholder is [] (hasPersonaMapping path)
    // text-parser (applyParsedFieldMappings) will extract ['admin'] from ticketFields.labels (with isArray:true on the fieldMapping)
    expect(n.personas).toEqual([])
    // labels base field present in ticketFields for text-parser to consume
    expect(n.ticketFields!['labels']).toEqual(['persona:admin', 'bug'])
  })

  it('status from fieldMappings routes to node.status (canonical root), not ticketFields.status', () => {
    const config: VertoConfig = {
      adapter: 'github',
      github: {
        scope: 'project', owner: 'test', projectNumber: 1,
        fieldMappings: {
          status: { from: { kind: 'projectV2', field: 'Status' }, type: 'select' },
        },
      },
    }
    const issue = makeIssue('A')
    const item = {
      issueNodeId: 'A',
      fieldValues: [{ fieldName: 'Status', kind: 'single_select' as const, value: 'In Progress' }],
    }
    const graph = mapIssuesToGraph([issue], new Map([['A', item]]), config)
    const n = graph.nodes[0]
    expect(n.status).toBe('In Progress')
    expect(n.ticketFields?.['status']).toBeUndefined()
  })
})
