import type { VertoNode } from '@verto/core'
import { CANONICAL_VERTO_NODE_KEYS } from '@verto/core'
import type { FieldMappingEntry, FieldMappings } from '@verto/config'
import { applyMappingTail } from '@verto/config'
import type {
  GitHubIssue,
  GitHubProjectV2FieldValue,
  GitHubProjectV2Item,
  IssueConnectionName,
  IssueIdConnection,
} from './system_types.js'

type SourceKind = FieldMappingEntry['from']['kind']

interface FieldAccessor {
  toVertoNodeFields(issue: GitHubIssue, projectItem?: GitHubProjectV2Item): Partial<VertoNode>
}

export class SystemFieldAccessor implements FieldAccessor {
  toVertoNodeFields(issue: GitHubIssue): Partial<VertoNode> {
    if (!issue.id) throw new Error('Issue has no id')
    if (!issue.url) throw new Error(`Issue ${issue.id} has no url`)

    const blockedByIds = issue.blockedBy.nodes.map(n => n.id)
    const subIssueIds = issue.subIssues.nodes.map(n => n.id)

    return {
      id: issue.id,
      title: issue.title || issue.id,
      isDone: issue.closed,
      isDeliverySlice: issue.parent === null,
      prereqIds: [...new Set([...blockedByIds, ...subIssueIds])],
      childIds: [...new Set(subIssueIds)],
      ticketUrl: issue.url,
      created_at: issue.createdAt,
    }
  }
}

/** Selects and flattens one `kind: "issue"` name that isn't a plain scalar `Issue` property. */
export interface IssuePropertyReader {
  /** GraphQL selection on `Issue`. */
  select: string
  read: (issue: GitHubIssue) => unknown
  /** Connection to follow past its first page. */
  paginated?: IssueConnectionName
}

const ids = (c: IssueIdConnection | undefined): string[] | null => c?.nodes.map(n => n.id) ?? null

/**
 * Flattening table for known non-scalar or renamed `Issue` properties — not an allow-list: any
 * other name is selected as a scalar and read as `issue[name]` (DESIGN.md §4.6.4).
 */
export const ISSUE_FIELD_RESOLVER: Record<string, IssuePropertyReader> = {
  type: { select: 'issueType { name }', read: i => i.issueType?.name ?? null },
  assignee: { select: 'assignees(first: 20) { nodes { login } }', read: i => i.assignees?.nodes[0]?.login ?? null },
  labels: { select: 'labels(first: 50) { nodes { name } }', read: i => i.labels.nodes.map(l => l.name) },
  created_at: { select: 'createdAt', read: i => i.createdAt },
  updated_at: { select: 'updatedAt', read: i => i.updatedAt ?? null },
  milestone: { select: 'milestone { title }', read: i => i.milestone?.title ?? null },
  duplicateOf: { select: 'duplicateOf { id }', read: i => i.duplicateOf?.id ?? null },
  relatesTo: {
    select: 'relatesTo(first: 100) { nodes { id } pageInfo { hasNextPage endCursor } }',
    read: i => ids(i.relatesTo),
    paginated: 'relatesTo',
  },
}

/** The reader for `name`, if any (own entries only, so `constructor` etc. stay plain names). */
export function issueReader(name: string): IssuePropertyReader | undefined {
  return Object.prototype.hasOwnProperty.call(ISSUE_FIELD_RESOLVER, name) ? ISSUE_FIELD_RESOLVER[name] : undefined
}

/** Value of the org issue field `name` (case-insensitive) on `issue`; `null` when unset. */
export function issueFieldValue(issue: GitHubIssue, name: string): unknown {
  const lower = name.toLowerCase()
  const node = issue.issueFieldValues?.nodes.find(n => n?.field?.name?.toLowerCase() === lower)
  if (!node) return null
  if (node.options) return node.options.map(o => o.name)
  return node.textValue ?? node.numberValue ?? node.dateValue ?? node.optionName ?? null
}

/** Raw value of a mapped field before `values` / `type`; `undefined` = no value source (skip the entry). */
function readRaw(kind: SourceKind, field: string, issue: GitHubIssue, projectItem?: GitHubProjectV2Item): unknown {
  switch (kind) {
    case 'issue': {
      const reader = issueReader(field)
      if (reader) return reader.read(issue)
      return Object.prototype.hasOwnProperty.call(issue, field) ? (issue[field] ?? null) : null
    }
    case 'issueField':
      return issueFieldValue(issue, field)
    case 'projectV2': {
      const fv = projectItem?.fieldValues.find(f => f.fieldName.toLowerCase() === field.toLowerCase())
      return fv ? resolveProjectV2Value(fv) : undefined
    }
    default:
      return undefined
  }
}

export class ProjectFieldAccessor implements FieldAccessor {
  /** Base fields of dot-notation entries not mapped by an entry of their own (read for @verto/text-parser). */
  private readonly autoIncludeBaseFields: Array<{ kind: SourceKind; baseField: string }> = []

  constructor(
    private readonly fieldMappings: FieldMappings,
    private readonly scope: 'project' | 'repository',
  ) {
    // Names compare like the tracker does: Issue properties exactly, custom fields case-insensitively.
    const id = (kind: SourceKind, field: string) => `${kind}:${kind === 'issue' ? field : field.toLowerCase()}`
    const explicit = new Set(
      Object.values(fieldMappings)
        .filter(e => !e.from.field.includes('.'))
        .map(e => id(e.from.kind, e.from.field)),
    )

    for (const entry of Object.values(fieldMappings)) {
      const dot = entry.from.field.indexOf('.')
      if (dot === -1) continue
      const { kind } = entry.from
      const baseField = entry.from.field.slice(0, dot)
      if (kind === 'projectV2' && scope === 'repository') continue
      if (explicit.has(id(kind, baseField))) continue
      explicit.add(id(kind, baseField))
      this.autoIncludeBaseFields.push({ kind, baseField })
    }
  }

  /** Tickets whose mapped priority was empty or invalid (defaulted to 5), for one log line per load. */
  emptyPriorityCount = 0

  toVertoNodeFields(issue: GitHubIssue, projectItem?: GitHubProjectV2Item): Partial<VertoNode> {
    const nodeFields: Partial<VertoNode> = {}
    const ticketFields: Record<string, unknown> = {}
    let prioritySet = false

    for (const [key, entry] of Object.entries(this.fieldMappings)) {
      const { from, values, type: typeHint } = entry

      // Dot-notation entries (e.g. "labels.persona") are handled by @verto/text-parser;
      // the adapter's job is only to ensure the base field is in ticketFields (see below).
      if (from.field.includes('.')) continue

      if (from.kind === 'projectV2' && this.scope === 'repository') {
        console.warn(
          `[verto] fieldMappings["${key}"]: kind 'projectV2' unavailable in repository scope, skipping`,
        )
        continue
      }
      const rawValue = readRaw(from.kind, from.field, issue, projectItem)
      if (rawValue === undefined) continue

      const value = applyMappingTail(rawValue, values, typeHint)

      if (key === 'priority') {
        const clamped = clampPriority(value)
        if (clamped !== null) {
          nodeFields.priority = clamped
          prioritySet = true
        }
        continue
      }

      if (CANONICAL_VERTO_NODE_KEYS.has(key)) {
        if (value !== null) (nodeFields as Record<string, unknown>)[key] = value
      } else {
        ticketFields[key] = value
      }
    }

    if (!prioritySet) {
      if (this.fieldMappings['priority']) this.emptyPriorityCount++
      nodeFields.priority = 5
    }

    // Auto-include base fields for dot-notation entries not covered by an explicit mapping.
    // text-parser reads these from ticketFields to apply parsed sub-field extraction.
    // Also fires when the field was explicitly mapped but produced null (e.g. a projectV2
    // mapping for a built-in field like "Labels" that doesn't appear in fieldValues).
    for (const { kind, baseField } of this.autoIncludeBaseFields) {
      if (ticketFields[baseField] !== undefined && ticketFields[baseField] !== null) continue
      const rawValue = readRaw(kind, baseField, issue, projectItem)
      if (rawValue !== null && rawValue !== undefined) ticketFields[baseField] = rawValue
    }

    if (Object.keys(ticketFields).length > 0) {
      nodeFields.ticketFields = { ...nodeFields.ticketFields, ...ticketFields }
    }

    return nodeFields
  }
}

function resolveProjectV2Value(fv: GitHubProjectV2FieldValue): unknown {
  switch (fv.kind) {
    case 'number': return fv.value
    case 'single_select': return fv.value
    case 'text': return fv.value
    case 'date': return fv.value
    case 'iteration': return fv.title
  }
}

function clampPriority(raw: unknown): number | null {
  if (typeof raw !== 'number' || !isFinite(raw)) return null
  return Math.min(9, Math.max(1, Math.round(raw)))
}
