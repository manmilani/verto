import type { VertoNode } from '@verto/core'
import { CANONICAL_VERTO_NODE_KEYS } from '@verto/core'
import type { FieldMappings, FieldMappingEntry } from '@verto/config'
import type { GitHubIssue, GitHubProjectV2FieldValue, GitHubProjectV2Item } from './system_types.js'

interface FieldAccessor {
  toVertoNodeFields(issue: GitHubIssue, projectItem?: GitHubProjectV2Item): Partial<VertoNode>
}

export class SystemFieldAccessor implements FieldAccessor {
  toVertoNodeFields(issue: GitHubIssue): Partial<VertoNode> {
    if (!issue.id) throw new Error('Issue has no id')
    if (!issue.title) throw new Error(`Issue ${issue.id} has no title`)
    if (!issue.url) throw new Error(`Issue ${issue.id} has no url`)

    const blockedByIds = issue.blockedBy.nodes.map(n => n.id)
    const subIssueIds = issue.subIssues.nodes.map(n => n.id)

    return {
      id: issue.id,
      title: issue.title,
      isDone: issue.closed,
      isDeliverySlice: issue.parent === null,
      prereqIds: [...new Set([...blockedByIds, ...subIssueIds])],
      childIds: [...new Set(subIssueIds)],
      ticketUrl: issue.url,
    }
  }
}

const ISSUE_FIELD_RESOLVER: Record<string, (issue: GitHubIssue) => unknown> = {
  type: i => i.issueType?.name ?? null,
  assignee: i => i.assignees.nodes[0]?.login ?? null,
  labels: i => i.labels.nodes.map(l => l.name),
  created_at: i => i.createdAt,
  updated_at: i => i.updatedAt,
  body: i => i.body,
  stateReason: i => i.stateReason,
  milestone: i => i.milestone?.title ?? null,
}

export class ProjectFieldAccessor implements FieldAccessor {
  constructor(
    private readonly fieldMappings: FieldMappings,
    private readonly scope: 'project' | 'repository',
  ) {}

  toVertoNodeFields(issue: GitHubIssue, projectItem?: GitHubProjectV2Item): Partial<VertoNode> {
    const nodeFields: Partial<VertoNode> = {}
    const ticketFields: Record<string, unknown> = {}
    let prioritySet = false
    let priorityMappingExists = false

    for (const [key, entry] of Object.entries(this.fieldMappings)) {
      const { from, values, type: typeHint } = entry
      let rawValue: unknown = null

      // Mark before any early-continue so the flag is set even when the field is absent
      if (key === 'priority') priorityMappingExists = true

      if (from.kind === 'projectV2') {
        if (this.scope === 'repository') {
          console.warn(
            `[verto] fieldMappings["${key}"]: kind 'projectV2' unavailable in repository scope, skipping`,
          )
          continue
        }
        if (!projectItem) continue
        const fv = projectItem.fieldValues.find(
          f => f.fieldName.toLowerCase() === from.field.toLowerCase(),
        )
        if (!fv) continue
        rawValue = resolveProjectV2Value(fv, values as Record<string, unknown> | undefined)
      } else {
        const resolver = ISSUE_FIELD_RESOLVER[from.field]
        rawValue = resolver
          ? resolver(issue)
          : ((issue as unknown as Record<string, unknown>)[from.field] ?? null)
        if (values && rawValue !== null) {
          rawValue = (values as Record<string, unknown>)[String(rawValue)] ?? null
        }
      }

      rawValue = coerceByType(rawValue, typeHint)

      if (key === 'priority') {
        const clamped = clampPriority(rawValue)
        if (clamped !== null) {
          nodeFields.priority = clamped
          prioritySet = true
        }
        continue
      }

      if (CANONICAL_VERTO_NODE_KEYS.has(key)) {
        ;(nodeFields as Record<string, unknown>)[key] = rawValue
      } else {
        ticketFields[key] = rawValue
      }
    }

    if (!prioritySet) {
      if (priorityMappingExists) {
        console.warn(`[verto] Issue ${issue.id}: priority mapping found but field is empty or unmapped, defaulting to 5`)
      } else {
        console.warn(`[verto] Issue ${issue.id}: no priority mapping, defaulting to 5`)
      }
      nodeFields.priority = 5
    }

    if (Object.keys(ticketFields).length > 0) {
      nodeFields.ticketFields = { ...nodeFields.ticketFields, ...ticketFields }
    }

    return nodeFields
  }
}

function resolveProjectV2Value(
  fv: GitHubProjectV2FieldValue,
  values?: Record<string, unknown>,
): unknown {
  switch (fv.kind) {
    case 'number': return fv.value
    case 'single_select': return values ? (values[fv.value] ?? fv.value) : fv.value
    case 'text': return fv.value
    case 'date': return fv.value
    case 'iteration': return fv.title
  }
}

function coerceByType(raw: unknown, typeHint: FieldMappingEntry['type']): unknown {
  if (raw === null || raw === undefined) return null
  switch (typeHint) {
    case 'number': {
      if (typeof raw === 'number') return raw
      const n = Number(raw)
      return isFinite(n) ? n : null
    }
    case 'text':
      return typeof raw === 'string' ? raw : String(raw)
    default:
      return raw
  }
}

function clampPriority(raw: unknown): number | null {
  if (typeof raw !== 'number' || !isFinite(raw)) return null
  return Math.min(9, Math.max(1, Math.round(raw)))
}
