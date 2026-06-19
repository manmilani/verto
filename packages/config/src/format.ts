import type { DisplayStatusGroup, FieldMappingEntry } from './types.js'

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function compact(value: unknown): string {
  return JSON.stringify(value)
}

function i(level: number): string {
  return ' '.repeat(level * 2)
}

function formatFieldMappings(mappings: Record<string, FieldMappingEntry>, level: number): string[] {
  const lines: string[] = [`${i(level)}"fieldMappings": {`]
  const entries = Object.entries(mappings)
  entries.forEach(([key, entry], idx) => {
    const comma = idx < entries.length - 1 ? ',' : ''
    lines.push(`${i(level + 1)}"${key}": ${compact(entry)}${comma}`)
  })
  lines.push(`${i(level)}}`)
  return lines
}

function formatDisplayStatusGroups(groups: DisplayStatusGroup[], level: number): string[] {
  const lines: string[] = [
    `${i(level)}// System-reserved display group "Done" matches node.isDone (ticket open/close via fieldMappings).`,
    `${i(level)}// It is always evaluated first and is not listed below.`,
    `${i(level)}"displayStatusGroups": [`,
  ]
  groups.forEach((group, idx) => {
    const comma = idx < groups.length - 1 ? ',' : ''
    lines.push(`${i(level + 1)}${compact(group)}${comma}`)
  })
  lines.push(`${i(level)}]`)
  return lines
}

function formatGithub(github: Record<string, unknown>, level: number): string[] {
  const lines: string[] = [`${i(level)}"github": {`]
  const { fieldMappings, ...rest } = github
  const restEntries = Object.entries(rest)
  restEntries.forEach(([key, value], idx) => {
    const hasMappings = isPlainObject(fieldMappings) && Object.keys(fieldMappings).length > 0
    const comma = idx < restEntries.length - 1 || hasMappings ? ',' : ''
    lines.push(`${i(level + 1)}"${key}": ${compact(value)}${comma}`)
  })
  if (isPlainObject(fieldMappings) && Object.keys(fieldMappings).length > 0) {
    lines.push(...formatFieldMappings(fieldMappings as Record<string, FieldMappingEntry>, level + 1))
  }
  lines.push(`${i(level)}}`)
  return lines
}

function formatUi(ui: Record<string, unknown>, level: number): string[] {
  const lines: string[] = [`${i(level)}"ui": {`]
  const groups = ui.displayStatusGroups
  if (Array.isArray(groups) && groups.length > 0) {
    lines.push(...formatDisplayStatusGroups(groups as DisplayStatusGroup[], level + 1))
  }
  lines.push(`${i(level)}}`)
  return lines
}

/** Compact JSONC body: one line per fieldMapping entry and displayStatusGroup. */
export function stringifyVertoConfig(content: Record<string, unknown>): string {
  const lines: string[] = ['{']
  const keys = Object.keys(content)
  keys.forEach((key, idx) => {
    const trailingComma = idx < keys.length - 1 ? ',' : ''
    const value = content[key]
    if (key === 'github' && isPlainObject(value)) {
      lines.push(...formatGithub(value, 1).map((line, lineIdx, arr) =>
        lineIdx === arr.length - 1 ? `${line}${trailingComma}` : line,
      ))
    } else if (key === 'ui' && isPlainObject(value)) {
      lines.push(...formatUi(value, 1).map((line, lineIdx, arr) =>
        lineIdx === arr.length - 1 ? `${line}${trailingComma}` : line,
      ))
    } else {
      lines.push(`${i(1)}"${key}": ${compact(value)}${trailingComma}`)
    }
  })
  lines.push('}')
  return `${lines.join('\n')}\n`
}

/** Leading // comment lines before the opening `{`. */
export function extractLeadingComments(content: string): string {
  const idx = content.indexOf('{')
  if (idx <= 0) return ''
  const prefix = content.slice(0, idx)
  const lines = prefix.split('\n')
  if (!lines.every(line => /^\s*(\/\/.*)?$/.test(line))) return ''
  return prefix
}
