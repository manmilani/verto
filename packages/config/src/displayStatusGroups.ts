import type { DisplayStatusGroup, FieldMappings } from './types.js'

type StatusNode = Pick<{ nodeType: 'ticket' | 'parsed'; status?: string }, 'nodeType' | 'status'>

/** System-reserved display group — always first; matches node.isDone only. */
export const SYSTEM_DONE_DISPLAY_GROUP_LABEL = 'Done'

/** Implicit bucket for workflow statuses not covered by user displayStatusGroups. */
export const OTHER_DISPLAY_STATUS_GROUP = 'others'

export interface StatusUniverse {
  ticket: Set<string>
  parsed: Set<string>
}

export function isReservedDoneLabel(label: string): boolean {
  return label.trim().toLowerCase() === 'done'
}

export function isReservedOthersLabel(label: string): boolean {
  return label === OTHER_DISPLAY_STATUS_GROUP
}

/** Validates user-configured displayStatusGroups (excludes system Done). */
export function validateUserDisplayStatusGroups(groups: DisplayStatusGroup[]): void {
  const labels = new Set<string>()
  const ticketStatuses = new Set<string>()
  const parsedStatuses = new Set<string>()

  for (const group of groups) {
    if (!group.label?.trim()) {
      throw new Error('Invalid VertoConfig: ui.displayStatusGroups entries require a non-empty label')
    }
    if (isReservedDoneLabel(group.label)) {
      throw new Error(
        'Invalid VertoConfig: label "Done" is system-reserved (matches node.isDone). '
        + 'Remove it from ui.displayStatusGroups and configure completion via fieldMappings instead.',
      )
    }
    if (isReservedOthersLabel(group.label)) {
      throw new Error(
        'Invalid VertoConfig: label "others" is system-reserved (implicit bucket for unlisted workflow statuses). '
        + 'Remove it from ui.displayStatusGroups and use a different label.',
      )
    }
    if (labels.has(group.label)) {
      throw new Error(
        `Invalid VertoConfig: duplicate displayStatusGroups label "${group.label}"`,
      )
    }
    labels.add(group.label)

    const { ticket, parsed } = group.sources
    if (!ticket && !parsed) {
      throw new Error(
        `Invalid VertoConfig: displayStatusGroups entry "${group.label}" has empty sources`,
      )
    }

    if (ticket) {
      validateSourceRule(group.label, 'ticket', ticket.statuses, ticketStatuses)
    }
    if (parsed) {
      validateSourceRule(group.label, 'parsed', parsed.statuses, parsedStatuses)
    }
  }
}

function validateSourceRule(
  groupLabel: string,
  source: 'ticket' | 'parsed',
  statuses: string[] | undefined,
  seen: Set<string>,
): void {
  if (!statuses || statuses.length === 0) {
    throw new Error(
      `Invalid VertoConfig: displayStatusGroups "${groupLabel}" sources.${source} requires a non-empty statuses array`,
    )
  }
  for (const status of statuses) {
    if (!status) {
      throw new Error(
        `Invalid VertoConfig: displayStatusGroups "${groupLabel}" sources.${source} contains an empty status`,
      )
    }
    if (seen.has(status)) {
      throw new Error(
        `Invalid VertoConfig: ticket/parsed status "${status}" appears in more than one displayStatusGroups entry`,
      )
    }
    seen.add(status)
  }
}

/** Status values that map to isDone:true via fieldMappings.isDone.values. */
export function isDoneMappedStatuses(fieldMappings?: FieldMappings): Set<string> {
  const set = new Set<string>()
  const values = fieldMappings?.isDone?.values
  if (!values) return set
  for (const [status, mapped] of Object.entries(values)) {
    if (mapped === true) set.add(status)
  }
  return set
}

/** Statuses explicitly listed on user displayStatusGroups for one source type. */
export function configuredStatusesForSource(
  groups: DisplayStatusGroup[],
  source: 'ticket' | 'parsed',
): Set<string> {
  const set = new Set<string>()
  for (const group of groups) {
    group.sources[source]?.statuses?.forEach(s => set.add(s))
  }
  return set
}

/** Statuses considered covered for sufficiency (configured + indirect isDone mapping). */
export function accountedStatusesForSource(
  groups: DisplayStatusGroup[],
  source: 'ticket' | 'parsed',
  fieldMappings?: FieldMappings,
): Set<string> {
  const accounted = configuredStatusesForSource(groups, source)
  if (source === 'ticket') {
    isDoneMappedStatuses(fieldMappings).forEach(s => accounted.add(s))
  } else {
    // Parsed completion is structural (checkbox → status 'done'); not user field-mapped.
    accounted.add('done')
  }
  return accounted
}

export function distinctStatusesFromNodes(
  nodes: Iterable<StatusNode>,
  source: 'ticket' | 'parsed',
): Set<string> {
  const set = new Set<string>()
  for (const node of nodes) {
    if (node.nodeType !== source) continue
    if (node.status !== undefined && node.status !== '') set.add(node.status)
  }
  return set
}

/** Union of project-audit options and distinct node.status values (refreshed each load). */
export function buildStatusUniverse(
  nodes: Iterable<StatusNode>,
  auditedTicketStatuses: string[] = [],
): StatusUniverse {
  const ticket = new Set(auditedTicketStatuses)
  distinctStatusesFromNodes(nodes, 'ticket').forEach(s => ticket.add(s))
  const parsed = distinctStatusesFromNodes(nodes, 'parsed')
  return { ticket, parsed }
}

export function hasUnaccountedStatuses(universe: Set<string>, accounted: Set<string>): boolean {
  for (const status of universe) {
    if (!accounted.has(status)) return true
  }
  return false
}

export function shouldShowOthersColumn(
  groups: DisplayStatusGroup[],
  universe: StatusUniverse,
  fieldMappings?: FieldMappings,
): boolean {
  const ticketAccounted = accountedStatusesForSource(groups, 'ticket', fieldMappings)
  const parsedAccounted = accountedStatusesForSource(groups, 'parsed', fieldMappings)
  return hasUnaccountedStatuses(universe.ticket, ticketAccounted)
    || hasUnaccountedStatuses(universe.parsed, parsedAccounted)
}

export function resolveDisplayStatusGroup(
  row: Pick<StatusNode, 'nodeType' | 'status'> & { isDone: boolean },
  userGroups: DisplayStatusGroup[],
): string {
  if (row.isDone) return SYSTEM_DONE_DISPLAY_GROUP_LABEL

  for (const group of userGroups) {
    const rule = group.sources[row.nodeType as 'ticket' | 'parsed']
    if (!rule?.statuses?.length) continue
    if (row.status !== undefined && rule.statuses.includes(row.status)) {
      return group.label
    }
  }
  return OTHER_DISPLAY_STATUS_GROUP
}

/** Column/legend labels: system Done, user groups, optional others. */
export function groupLabelsForDisplay(
  userGroups: DisplayStatusGroup[],
  showOthers: boolean,
): string[] {
  const labels = [SYSTEM_DONE_DISPLAY_GROUP_LABEL, ...userGroups.map(g => g.label)]
  if (showOthers && !labels.includes(OTHER_DISPLAY_STATUS_GROUP)) {
    labels.push(OTHER_DISPLAY_STATUS_GROUP)
  }
  return labels
}

export function resolveDisplayStatusGroupIndex(
  row: Pick<StatusNode, 'nodeType' | 'status'> & { isDone: boolean },
  userGroups: DisplayStatusGroup[],
): number {
  const label = resolveDisplayStatusGroup(row, userGroups)
  if (label === OTHER_DISPLAY_STATUS_GROUP) return -1
  if (label === SYSTEM_DONE_DISPLAY_GROUP_LABEL) return 0
  const userIdx = userGroups.findIndex(g => g.label === label)
  return userIdx < 0 ? -1 : userIdx + 1
}

/** Open / not-yet-done nodes are delivery gaps. */
export function isGap(row: { isDone: boolean }): boolean {
  return !row.isDone
}

export function formatDisplayGroupsProse(userGroups: DisplayStatusGroup[]): string {
  if (userGroups.length === 0) return 'in a configured delivery state'
  const labels = [SYSTEM_DONE_DISPLAY_GROUP_LABEL, ...userGroups.map(g => g.label)]
  if (labels.length === 1) return labels[0]!
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`
}

function unaccountedStatuses(universe: Set<string>, accounted: Set<string>): string[] {
  const out: string[] = []
  for (const status of universe) {
    if (!accounted.has(status)) out.push(status)
  }
  return out.sort()
}

/** Tooltip for the system Done group. */
export function formatDoneGroupTooltip(fieldMappings?: FieldMappings): string {
  const entry = fieldMappings?.isDone
  const mapped = [...isDoneMappedStatuses(fieldMappings)].sort()
  if (entry?.values && mapped.length > 0) {
    const from = entry.from
    const fieldRef = from?.kind === 'projectV2'
      ? `project field "${from.field}"`
      : from?.kind === 'issue'
        ? `issue field "${from.field}"`
        : 'configured field'
    return `isDone when ${fieldRef} is: ${mapped.join(', ')}`
  }
  return 'isDone when the GitHub issue is closed (issue.closed)'
}

/** Tooltip for one user-configured display group. */
export function formatUserGroupTooltip(group: DisplayStatusGroup): string {
  const parts: string[] = []
  const ticket = group.sources.ticket?.statuses
  const parsed = group.sources.parsed?.statuses
  if (ticket?.length) parts.push(`Tickets: ${ticket.join(', ')}`)
  if (parsed?.length) parts.push(`Parsed: ${parsed.join(', ')}`)
  return parts.join(' · ')
}

/** Tooltip for the implicit others bucket (unaccounted statuses in the current universe). */
export function formatOthersGroupTooltip(
  groups: DisplayStatusGroup[],
  universe: StatusUniverse,
  fieldMappings?: FieldMappings,
): string {
  const ticket = unaccountedStatuses(
    universe.ticket,
    accountedStatusesForSource(groups, 'ticket', fieldMappings),
  )
  const parsed = unaccountedStatuses(
    universe.parsed,
    accountedStatusesForSource(groups, 'parsed', fieldMappings),
  )
  const parts: string[] = []
  if (ticket.length) parts.push(`Tickets: ${ticket.join(', ')}`)
  if (parsed.length) parts.push(`Parsed: ${parsed.join(', ')}`)
  if (parts.length === 0) return 'Workflow statuses not listed in displayStatusGroups'
  return parts.join(' · ')
}

/** Label → tooltip for legend, column headers, and segment keys. */
export function buildDisplayStatusGroupTooltips(
  groups: DisplayStatusGroup[],
  universe: StatusUniverse,
  fieldMappings: FieldMappings | undefined,
  showOthers: boolean,
): Record<string, string> {
  const tooltips: Record<string, string> = {
    [SYSTEM_DONE_DISPLAY_GROUP_LABEL]: formatDoneGroupTooltip(fieldMappings),
  }
  for (const group of groups) {
    tooltips[group.label] = formatUserGroupTooltip(group)
  }
  if (showOthers) {
    tooltips[OTHER_DISPLAY_STATUS_GROUP] = formatOthersGroupTooltip(groups, universe, fieldMappings)
  }
  return tooltips
}
