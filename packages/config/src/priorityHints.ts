import type { FieldMappingEntry } from './types.js'

/** Tracker label hints keyed by Verto priority level (1–9). */
export type PriorityOptionHints = Partial<Record<number, string>>

const PRIORITY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

/**
 * Inverts fieldMappings.priority.values (tracker label → level) into level → label.
 * Multiple tracker labels mapping to the same level are joined with " / ".
 */
export function buildPriorityOptionHints(
  priorityMapping?: FieldMappingEntry,
): PriorityOptionHints {
  const hints: PriorityOptionHints = {}
  if (!priorityMapping?.values) return hints

  for (const [trackerLabel, raw] of Object.entries(priorityMapping.values)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
    const level = Math.max(1, Math.min(9, Math.round(raw)))
    hints[level] = hints[level] ? `${hints[level]} / ${trackerLabel}` : trackerLabel
  }
  return hints
}

/**
 * Parenthetical hint for a priority dropdown option.
 * Mapped tracker label wins over built-in fallbacks for 1, 5, and 9.
 */
export function formatPriorityOptionHint(
  level: number,
  mappingHints: PriorityOptionHints,
): string | undefined {
  const mapped = mappingHints[level]
  if (mapped) return mapped
  if (level === 1) return 'most important'
  if (level === 5) return 'default'
  if (level === 9) return 'least important'
  return undefined
}

export function formatPriorityLevelCode(level: number): string {
  return `P${level}`
}

export function formatPriorityOptionLabel(
  level: number,
  mappingHints: PriorityOptionHints,
): string {
  const hint = formatPriorityOptionHint(level, mappingHints)
  const code = formatPriorityLevelCode(level)
  return hint ? `${code} (${hint})` : code
}

export function allPriorityLevels(): readonly number[] {
  return PRIORITY_LEVELS
}
