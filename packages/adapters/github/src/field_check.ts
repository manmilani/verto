import type { MissingField } from '@verto/core'
import type { FieldMappingEntry, VertoConfig } from '@verto/config'
import { requireGitHubConfig } from './githubConfig.js'
import { gqlRequest } from './gqlRequest.js'
import { baseField, issuePropertySelection, SYSTEM_ISSUE_SELECTION } from './issue_selection.js'
import { fetchProjectFieldNodes } from './statusOptions.js'

type SourceKind = FieldMappingEntry['from']['kind']
type Status = 'exists' | 'unsupported' | 'missing'

/** What one kind's lookup found: the status of a base name, and the scope it searched. */
interface Lookup {
  status(name: string): Status
  scope: string
}

const KINDS: SourceKind[] = ['issue', 'issueField', 'projectV2']

/** The `errors[]` of an `@octokit/graphql` `GraphqlResponseError`, if `err` is one. */
function graphqlErrors(err: unknown): Array<{ path?: unknown[]; extensions?: { code?: string } }> | undefined {
  const errors = (err as { errors?: unknown } | null)?.errors
  return Array.isArray(errors) ? errors : undefined
}

/**
 * One validate-only query (`first: 0`) selecting every name as an `Issue` property, each under
 * its own alias, so every validation error belongs to one name and names can't conflict.
 */
async function probeIssueProperties(token: string, names: string[]): Promise<Lookup> {
  const scope = 'GitHub Issue properties'
  const sent = names.filter(n => issuePropertySelection(n) !== undefined)
  const status = new Map<string, Status>(sent.map(n => [n, 'exists']))
  const lookup: Lookup = { status: name => status.get(name) ?? 'missing', scope }
  if (sent.length === 0) return lookup

  const aliasOf = new Map(sent.map((name, i) => [`f${i}`, name]))
  const selection = [
    ...SYSTEM_ISSUE_SELECTION.map((s, i) => `s${i}: ${s}`),
    ...[...aliasOf].map(([alias, name]) => `${alias}: ${issuePropertySelection(name)}`),
  ].join('\n')
  try {
    await gqlRequest(token, `query { viewer { issues(first: 0) { nodes { ${selection} } } } }`)
  } catch (err) {
    const errors = graphqlErrors(err)
    if (!errors) throw err
    const found: Array<[string, Status]> = []
    for (const e of errors) {
      const alias = e.path?.find((p): p is string => typeof p === 'string' && aliasOf.has(p))
      if (!alias) throw err
      found.push([aliasOf.get(alias)!, e.extensions?.code === 'undefinedField' ? 'missing' : 'unsupported'])
    }
    for (const [name, s] of found) if (status.get(name) !== 'missing') status.set(name, s)
  }
  return lookup
}

/** Org issue-field definitions of `owner`; a user account has none. */
async function fetchIssueFieldNames(token: string, owner: string): Promise<Lookup> {
  const data = await gqlRequest(
    token,
    `query($owner: String!) {
      repositoryOwner(login: $owner) {
        __typename
        ... on Organization { issueFields(first: 100) { nodes { ... on IssueFieldCommon { name } } } }
      }
    }`,
    { owner },
  ) as {
    repositoryOwner?: { __typename?: string; issueFields?: { nodes: Array<{ name?: string } | null> } | null } | null
  }
  const ro = data.repositoryOwner
  if (ro?.__typename !== 'Organization') {
    return { status: () => 'missing', scope: `${owner} (no organization; issue fields require one)` }
  }
  if (!ro.issueFields) throw new Error(`issue fields of org ${owner} are not readable`)
  const names = new Set(ro.issueFields.nodes.map(n => n?.name?.toLowerCase()).filter(Boolean))
  return { status: name => (names.has(name.toLowerCase()) ? 'exists' : 'missing'), scope: `org ${owner}` }
}

async function fetchProjectFieldNames(token: string, config: VertoConfig, scope: string): Promise<Lookup> {
  const fields = await fetchProjectFieldNodes(token, config)
  const names = new Set((fields ?? []).map(f => f.name?.toLowerCase()).filter(Boolean))
  return { status: name => (names.has(name.toLowerCase()) ? 'exists' : 'missing'), scope }
}

/**
 * The GitHub load-time field check (DESIGN.md §4.6.4, §4.6.7): every mapped base name is looked
 * up in all three kinds once. A lookup that fails leaves its kind unchecked (its mappings are
 * trusted, it gives no suggestions) and, if that kind is mapped, `warn` says so.
 */
export async function checkGitHubFields(
  token: string,
  config: VertoConfig,
  warn: (message: string) => void = console.warn,
): Promise<MissingField[]> {
  const github = requireGitHubConfig(config)
  const entries = Object.entries(github.fieldMappings ?? {})
    .filter(([, e]) => !(e.from.kind === 'projectV2' && github.scope !== 'project'))
    .map(([key, e]) => ({ key, kind: e.from.kind, field: e.from.field, base: baseField(e.from.field) }))
  if (entries.length === 0) return []

  const names = [...new Set(entries.map(e => e.base))]
  const run: Record<SourceKind, () => Promise<Lookup> | undefined> = {
    issue: () => probeIssueProperties(token, names),
    issueField: () => fetchIssueFieldNames(token, github.owner),
    projectV2: () => github.scope === 'project'
      ? fetchProjectFieldNames(token, config, `${github.owner}/project ${github.projectNumber}`)
      : undefined,
  }
  const results = await Promise.allSettled(KINDS.map(k => run[k]() ?? Promise.resolve(undefined)))

  const lookups = new Map<SourceKind, Lookup>()
  KINDS.forEach((kind, i) => {
    const r = results[i]
    if (r.status === 'fulfilled') {
      if (r.value) lookups.set(kind, r.value)
    } else if (entries.some(e => e.kind === kind)) {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
      warn(`Verto: couldn't check fieldMappings of kind "${kind}": ${msg}`)
    }
  })

  const missing: MissingField[] = []
  for (const e of entries) {
    const own = lookups.get(e.kind)
    if (!own) continue
    const status = own.status(e.base)
    if (status === 'exists') continue
    missing.push({
      key: e.key,
      field: e.field,
      kind: e.kind,
      scope: own.scope,
      reason: status,
      suggestedKinds: status === 'missing'
        ? KINDS.filter(k => k !== e.kind && lookups.get(k)?.status(e.base) === 'exists')
        : [],
    })
  }
  return missing
}
