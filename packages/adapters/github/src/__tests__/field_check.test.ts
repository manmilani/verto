import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FieldMappings, VertoConfig } from '@verto/config'

vi.mock('../gqlRequest.js', () => ({ gqlRequest: vi.fn() }))
const { gqlRequest } = await import('../gqlRequest.js')
const { checkGitHubFields } = await import('../field_check.js')
const gql = vi.mocked(gqlRequest)

/** An `@octokit/graphql` GraphqlResponseError-shaped rejection. */
function graphqlError(errors: Array<{ path: unknown[]; code: string }>): Error {
  return Object.assign(new Error('Request failed due to following response errors'), {
    errors: errors.map(e => ({ path: e.path, extensions: { code: e.code }, message: e.code })),
  })
}

/** Path of the probe entry for the n-th sent name (`f<n>`), optionally deeper. */
const probePath = (n: number, ...rest: string[]) => ['query', 'viewer', 'issues', 'nodes', `f${n}`, ...rest]

interface Responses {
  probe?: () => unknown
  owner?: () => unknown
  project?: () => unknown
}

function respond({ probe, owner, project }: Responses) {
  gql.mockImplementation(async (_token: string, query: string) => {
    if (query.includes('viewer')) return probe ? probe() : { viewer: { issues: { nodes: [] } } }
    if (query.includes('repositoryOwner')) {
      return owner ? owner() : { repositoryOwner: { __typename: 'Organization', issueFields: { nodes: [] } } }
    }
    if (query.includes('projectV2')) return project ? project() : { user: { projectV2: { fields: { nodes: [] } } } }
    throw new Error(`unexpected query ${query}`)
  })
}

const org = (...names: string[]) => () => ({
  repositoryOwner: { __typename: 'Organization', issueFields: { nodes: names.map(name => ({ name })) } },
})
const projectFields = (...names: string[]) => () => ({ user: { projectV2: { fields: { nodes: names.map(name => ({ name })) } } } })

const repo = (fieldMappings: FieldMappings): VertoConfig => ({
  adapter: 'github',
  github: { scope: 'repository', owner: 'acme', repository: 'app', fieldMappings },
})
const project = (fieldMappings: FieldMappings): VertoConfig => ({
  adapter: 'github',
  github: { scope: 'project', owner: 'acme', projectNumber: 3, fieldMappings },
})

describe('checkGitHubFields', () => {
  beforeEach(() => { gql.mockReset() })

  it('existing fields of every kind → nothing reported', async () => {
    respond({ owner: org('Priority'), project: projectFields('Status') })
    const out = await checkGitHubFields('t', project({
      type: { from: { kind: 'issue', field: 'type' } },
      priority: { from: { kind: 'issueField', field: 'priority' } },
      status: { from: { kind: 'projectV2', field: 'status' } },
      personas: { from: { kind: 'issue', field: 'labels.persona' } },
    }))
    expect(out).toEqual([])
  })

  it('probe: one validate-only query, every name under its own alias (incl. names of other kinds)', async () => {
    respond({})
    await checkGitHubFields('t', repo({
      type: { from: { kind: 'issue', field: 'type' } },
      risk: { from: { kind: 'issueField', field: 'Risk' } },
    }))
    const query = gql.mock.calls.map(c => c[1]).find(q => q.includes('viewer'))!
    expect(query).toContain('issues(first: 0)')
    expect(query).toContain('f0: issueType { name }')
    expect(query).toContain('f1: Risk')
    expect(query).toMatch(/s0: id/)
  })

  it('missing issue property found as an org issue field → suggested (AC 4, 5)', async () => {
    respond({
      probe: () => { throw graphqlError([{ path: probePath(0), code: 'undefinedField' }]) },
      owner: org('Priority'),
    })
    const out = await checkGitHubFields('t', repo({ priority: { from: { kind: 'issue', field: 'Priority' } } }))
    expect(out).toEqual([{
      key: 'priority', field: 'Priority', kind: 'issue', scope: 'GitHub Issue properties',
      reason: 'missing', suggestedKinds: ['issueField'],
    }])
  })

  it('missing issue field found as an Issue property → suggested; missing project field likewise', async () => {
    respond({ owner: org(), project: projectFields('Status') })
    const out = await checkGitHubFields('t', project({
      closed_flag: { from: { kind: 'issueField', field: 'closed' } },
      state: { from: { kind: 'projectV2', field: 'stateReason' } },
    }))
    expect(out).toEqual([
      { key: 'closed_flag', field: 'closed', kind: 'issueField', scope: 'org acme', reason: 'missing', suggestedKinds: ['issue'] },
      { key: 'state', field: 'stateReason', kind: 'projectV2', scope: 'acme/project 3', reason: 'missing', suggestedKinds: ['issue'] },
    ])
  })

  it('object/connection without a reader → unsupported, and never suggested as kind issue', async () => {
    respond({
      probe: () => { throw graphqlError([{ path: probePath(0), code: 'selectionMismatch' }]) },
      owner: org(),
    })
    const out = await checkGitHubFields('t', repo({
      who: { from: { kind: 'issue', field: 'author' } },
      who2: { from: { kind: 'issueField', field: 'author' } },
    }))
    expect(out).toEqual([
      { key: 'who', field: 'author', kind: 'issue', scope: 'GitHub Issue properties', reason: 'unsupported', suggestedKinds: [] },
      { key: 'who2', field: 'author', kind: 'issueField', scope: 'org acme', reason: 'missing', suggestedKinds: [] },
    ])
  })

  it('an error inside a reader sub-selection belongs to that reader', async () => {
    respond({ probe: () => { throw graphqlError([{ path: probePath(0, 'nodes', 'id'), code: 'someNewCode' }]) } })
    const out = await checkGitHubFields('t', repo({ rel: { from: { kind: 'issue', field: 'relatesTo' } } }))
    expect(out.map(m => [m.key, m.reason])).toEqual([['rel', 'unsupported']])
  })

  it('user-owned repo: every issueField mapping is missing, with the reason in the scope', async () => {
    respond({
      probe: () => { throw graphqlError([{ path: probePath(0), code: 'undefinedField' }]) },
      owner: () => ({ repositoryOwner: { __typename: 'User' } }),
    })
    const out = await checkGitHubFields('t', repo({ priority: { from: { kind: 'issueField', field: 'Priority' } } }))
    expect(out).toEqual([{
      key: 'priority', field: 'Priority', kind: 'issueField', scope: 'acme (no organization; issue fields require one)',
      reason: 'missing', suggestedKinds: [],
    }])
  })

  it('repository scope: projectV2 entries are not checked and projectV2 is never looked up', async () => {
    respond({})
    const out = await checkGitHubFields('t', repo({ status: { from: { kind: 'projectV2', field: 'Nope' } } }))
    expect(out).toEqual([])
    expect(gql.mock.calls.some(c => c[1].includes('projectV2'))).toBe(false)
  })

  it('dot-notation entries are checked by their base field', async () => {
    respond({ probe: () => { throw graphqlError([{ path: probePath(0), code: 'undefinedField' }]) } })
    const out = await checkGitHubFields('t', repo({ phase: { from: { kind: 'issue', field: 'bodyy.PHASE' } } }))
    expect(out).toEqual([expect.objectContaining({ key: 'phase', field: 'bodyy.PHASE', reason: 'missing' })])
  })

  it('a name that is not a GraphQL name is missing as an Issue property without being sent', async () => {
    respond({ owner: org('Target date') })
    const out = await checkGitHubFields('t', repo({ target: { from: { kind: 'issue', field: 'Target date' } } }))
    expect(out).toEqual([expect.objectContaining({ key: 'target', reason: 'missing', suggestedKinds: ['issueField'] })])
    expect(gql.mock.calls.some(c => c[1].includes('viewer'))).toBe(false)
  })

  it('a failed lookup leaves its kind unchecked and warns once if that kind is mapped', async () => {
    respond({ owner: () => { throw new Error('Resource not accessible by integration') } })
    const warn = vi.fn()
    const out = await checkGitHubFields('t', repo({ priority: { from: { kind: 'issueField', field: 'Prio' } } }), warn)
    expect(out).toEqual([])
    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith('Verto: couldn\'t check fieldMappings of kind "issueField": Resource not accessible by integration')
  })

  it('an org whose issue fields are not readable (null) leaves kind issueField unchecked', async () => {
    respond({ owner: () => ({ repositoryOwner: { __typename: 'Organization', issueFields: null } }) })
    const warn = vi.fn()
    const out = await checkGitHubFields('t', repo({ priority: { from: { kind: 'issueField', field: 'Prio' } } }), warn)
    expect(out).toEqual([])
    expect(warn).toHaveBeenCalledOnce()
  })

  it('a failed lookup of an unmapped kind only loses suggestions, silently', async () => {
    respond({
      probe: () => { throw graphqlError([{ path: probePath(0), code: 'undefinedField' }]) },
      owner: () => { throw new Error('boom') },
    })
    const warn = vi.fn()
    const out = await checkGitHubFields('t', repo({ priority: { from: { kind: 'issue', field: 'Priority' } } }), warn)
    expect(out).toEqual([expect.objectContaining({ key: 'priority', reason: 'missing', suggestedKinds: [] })])
    expect(warn).not.toHaveBeenCalled()
  })

  it('a probe error that belongs to no mapping (e.g. system part) makes kind issue unknown', async () => {
    respond({
      probe: () => {
        throw graphqlError([
          { path: probePath(0), code: 'undefinedField' },
          { path: ['query', 'viewer', 'issues', 'nodes', 's3'], code: 'undefinedField' },
        ])
      },
    })
    const warn = vi.fn()
    const out = await checkGitHubFields('t', repo({ x: { from: { kind: 'issue', field: 'nope' } } }), warn)
    expect(out).toEqual([])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('kind "issue"'))
  })

  it('no mappings → no queries', async () => {
    respond({})
    expect(await checkGitHubFields('t', repo({}))).toEqual([])
    expect(gql).not.toHaveBeenCalled()
  })
})
