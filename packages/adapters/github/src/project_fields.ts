import type { VertoNode } from '@verto/core'
import { CANONICAL_VERTO_NODE_KEYS } from '@verto/core'
import type { FieldMappings } from '@verto/config'
import { coerceFieldValue } from '@verto/config'
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
      created_at: issue.createdAt,
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
  private readonly autoIncludeBaseFields: Map<string, (issue: GitHubIssue) => unknown>
  private readonly autoIncludeProjectV2BaseFields: Set<string>

  constructor(
    private readonly fieldMappings: FieldMappings,
    private readonly scope: 'project' | 'repository',
  ) {
    // Pre-compute which base fields must be auto-included for dot-notation entries.
    // A base field only needs auto-include if it isn't also directly mapped by its own entry.
    const explicitIssueFields = new Set<string>()
    const explicitProjectV2Fields = new Set<string>()
    for (const entry of Object.values(fieldMappings)) {
      if (entry.from.field.includes('.')) continue
      if (entry.from.kind === 'issue') explicitIssueFields.add(entry.from.field)
      else if (entry.from.kind === 'projectV2') explicitProjectV2Fields.add(entry.from.field.toLowerCase())
    }

    this.autoIncludeBaseFields = new Map()
    this.autoIncludeProjectV2BaseFields = new Set()

    for (const [key, entry] of Object.entries(fieldMappings)) {
      const dot = entry.from.field.indexOf('.')
      if (dot === -1) continue
      const baseField = entry.from.field.slice(0, dot)

      if (entry.from.kind === 'issue') {
        if (!explicitIssueFields.has(baseField) && !this.autoIncludeBaseFields.has(baseField)) {
          const resolver = ISSUE_FIELD_RESOLVER[baseField]
            ?? ((i: GitHubIssue) => (i as unknown as Record<string, unknown>)[baseField] ?? null)
          this.autoIncludeBaseFields.set(baseField, resolver)
        }
      } else if (entry.from.kind === 'projectV2') {
        if (!explicitProjectV2Fields.has(baseField.toLowerCase())) {
          this.autoIncludeProjectV2BaseFields.add(baseField)
        }
      } else {
        console.warn(`[verto] fieldMappings["${key}"]: unknown kind '${entry.from.kind}', skipping`)
      }
    }
  }

  toVertoNodeFields(issue: GitHubIssue, projectItem?: GitHubProjectV2Item): Partial<VertoNode> {
    const nodeFields: Partial<VertoNode> = {}
    const ticketFields: Record<string, unknown> = {}
    let prioritySet = false
    let priorityMappingExists = false

    for (const [key, entry] of Object.entries(this.fieldMappings)) {
      const { from, values, type: typeHint } = entry
      let rawValue: unknown = null

      // Dot-notation entries (e.g. "labels.persona") are handled by @verto/text-parser;
      // the adapter's job is only to ensure the base field is in ticketFields (see below).
      if (from.field.includes('.')) continue

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

      rawValue = coerceFieldValue(rawValue, typeHint)

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

    // Auto-include base fields for dot-notation entries not covered by an explicit mapping.
    // text-parser reads these from ticketFields to apply parsed sub-field extraction.
    // Also fires when the field was explicitly mapped but produced null (e.g. a projectV2
    // mapping for a built-in field like "Labels" that doesn't appear in fieldValues).
    for (const [baseField, resolver] of this.autoIncludeBaseFields) {
      if (!(baseField in ticketFields) || ticketFields[baseField] === null) {
        const rawValue = resolver(issue)
        if (rawValue !== null && rawValue !== undefined) {
          ticketFields[baseField] = rawValue
        }
      }
    }

    // Auto-include projectV2 base fields for dot-notation entries with kind:'projectV2'.
    if (this.scope !== 'repository' && projectItem) {
      for (const baseField of this.autoIncludeProjectV2BaseFields) {
        if (baseField in ticketFields && ticketFields[baseField] !== null) continue
        const fv = projectItem.fieldValues.find(
          f => f.fieldName.toLowerCase() === baseField.toLowerCase(),
        )
        if (fv) {
          ticketFields[baseField] = resolveProjectV2Value(fv)
        }
      }
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

function clampPriority(raw: unknown): number | null {
  if (typeof raw !== 'number' || !isFinite(raw)) return null
  return Math.min(9, Math.max(1, Math.round(raw)))
}
