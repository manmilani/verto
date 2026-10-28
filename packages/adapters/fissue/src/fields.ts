import type { MissingField } from '@verto/core'
import type { FieldMappings } from '@verto/config'
import type { FissueProjectConfig } from './system_types.js'

/**
 * The field check (DESIGN.md §4.6.4) for fissue: fields are found by name only (fissue's `kind` is
 * informational). An undefined base field is `missing`; a `projectV2` source is `unsupported`.
 */
export function checkFieldsAgainst(
  fieldMappings: FieldMappings,
  fissueConfig: FissueProjectConfig,
  scope: string,
): MissingField[] {
  const out: MissingField[] = []
  for (const [key, entry] of Object.entries(fieldMappings)) {
    const { kind, field } = entry.from
    const dot = field.indexOf('.')
    const base = dot === -1 ? field : field.slice(0, dot)
    const reason = kind === 'projectV2'
      ? 'unsupported'
      : !Object.hasOwn(fissueConfig.fields, base) ? 'missing' : null
    if (reason) out.push({ key, field, kind, scope, reason, suggestedKinds: [] })
  }
  return out
}
