import type { FieldMappingEntry, FieldMappings } from '@verto/config'
import { githubAdapterDefaults } from './defaults.js'

export type ProjectFieldNode = {
  name?: string
  dataType?: string
  options?: Array<{ name: string }>
}

/** Case-insensitive ProjectV2 column name comparison (matches project_fields.ts value reads). */
export function projectFieldNamesMatch(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Reverse lookup: Verto canonical `fieldMappings` key → configured ProjectV2 column name.
 * Falls back to adapter defaults when the workspace mapping is absent.
 */
export function resolveProjectV2FieldName(
  fieldMappings: FieldMappings | undefined,
  canonicalKey: string,
): string | undefined {
  const entry = fieldMappings?.[canonicalKey]
    ?? githubAdapterDefaults.github?.fieldMappings?.[canonicalKey]
  const from = entry?.from
  if (from?.kind === 'projectV2' && from.field) return from.field
  return undefined
}

export function findProjectFieldNode(
  fields: ProjectFieldNode[],
  configuredFieldName: string,
): ProjectFieldNode | undefined {
  return fields.find(f => f.name && projectFieldNamesMatch(f.name, configuredFieldName))
}

/** Single-select option names for a canonical Verto field mapped to ProjectV2. */
export function singleSelectOptionsFromProjectField(
  fields: ProjectFieldNode[],
  fieldMappings: FieldMappings | undefined,
  canonicalKey: string,
): string[] {
  const configuredName = resolveProjectV2FieldName(fieldMappings, canonicalKey)
  if (!configuredName) return []
  const field = findProjectFieldNode(fields, configuredName)
  if (!field?.options) return []
  return field.options.map(o => o.name)
}

function defaultProjectV2Mapping(canonicalKey: string): FieldMappingEntry | undefined {
  return githubAdapterDefaults.github?.fieldMappings?.[canonicalKey]
}

function mappingEntryForProjectField(
  fieldMappings: FieldMappings,
  field: ProjectFieldNode,
): FieldMappingEntry {
  const discoveredKey = field.name!.toLowerCase().replace(/\s+/g, '_')
  const discovered = fieldMappings[discoveredKey]
  if (discovered?.from.kind === 'projectV2') {
    return { ...discovered, from: { kind: 'projectV2', field: field.name! } }
  }
  const entry: FieldMappingEntry = { from: { kind: 'projectV2', field: field.name! } }
  if (field.dataType === 'SINGLE_SELECT') entry.type = 'select'
  if (field.dataType === 'NUMBER') entry.type = 'number'
  if (field.dataType === 'DATE') entry.type = 'date'
  if (field.dataType === 'ITERATION') entry.type = 'iteration'
  return entry
}

export interface SeedProjectV2MappingOptions {
  /** Conventional GitHub column name to match when no adapter default exists (e.g. priority). */
  bootstrapFieldName?: string
}

/**
 * Seed `fieldMappings[canonicalKey]` during audit/bootstrap:
 * 1. workspace input mapping
 * 2. discovery key already present (normalized field name)
 * 3. case-insensitive match on adapter default or bootstrapFieldName
 * 4. adapter default entry (status only today)
 */
export function seedCanonicalProjectV2FieldMapping(
  fieldMappings: FieldMappings,
  fields: ProjectFieldNode[],
  canonicalKey: string,
  inputMappings?: FieldMappings,
  options?: SeedProjectV2MappingOptions,
): boolean {
  if (inputMappings?.[canonicalKey]) {
    fieldMappings[canonicalKey] = inputMappings[canonicalKey]
    return true
  }

  const existing = fieldMappings[canonicalKey]
  if (existing?.from?.kind === 'projectV2') return true

  const defaultEntry = defaultProjectV2Mapping(canonicalKey)
  const matchNames: string[] = []
  if (defaultEntry?.from.kind === 'projectV2' && defaultEntry.from.field) {
    matchNames.push(defaultEntry.from.field)
  }
  if (options?.bootstrapFieldName) {
    matchNames.push(options.bootstrapFieldName)
  }

  for (const candidate of matchNames) {
    const match = findProjectFieldNode(fields, candidate)
    if (match?.name) {
      fieldMappings[canonicalKey] = mappingEntryForProjectField(fieldMappings, match)
      return true
    }
  }

  if (defaultEntry) {
    fieldMappings[canonicalKey] = defaultEntry
    return true
  }

  return false
}

/** Status column options (canonical key `status`). */
export function statusOptionsFromProjectFields(
  fields: ProjectFieldNode[],
  fieldMappings?: FieldMappings,
): string[] {
  return singleSelectOptionsFromProjectField(fields, fieldMappings, 'status')
}

/** @deprecated Prefer resolveProjectV2FieldName(fieldMappings, 'status'). */
export function resolveStatusProjectV2FieldName(fieldMappings?: FieldMappings): string | undefined {
  return resolveProjectV2FieldName(fieldMappings, 'status')
}
