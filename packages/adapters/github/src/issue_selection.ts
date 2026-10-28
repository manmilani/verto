import type { FieldMappings } from '@verto/config'
import { issueReader } from './project_fields.js'
import type { IssueConnectionName } from './system_types.js'

const PAGE = 'nodes { id } pageInfo { hasNextPage endCursor }'

/** What `SystemFieldAccessor`, `mapper.ts` and `closure.ts` read from every issue. */
export const SYSTEM_ISSUE_SELECTION: readonly string[] = [
  'id',
  'title',
  'closed',
  'url',
  'createdAt',
  'parent { id }',
  'labels(first: 50) { nodes { name } }',
  `subIssues(first: 100) { ${PAGE} }`,
  `blockedBy(first: 100) { ${PAGE} }`,
  `blocking(first: 100) { ${PAGE} }`,
]

const FIELD_NAME = 'field { ... on IssueFieldCommon { name } }'

/** Org issue-field values; `value` differs in type per value type, so each is aliased. Orgs have ≤ 25 fields. */
export const ISSUE_FIELD_VALUES_SELECTION = `issueFieldValues(first: 50) { nodes {
  ... on IssueFieldTextValue         { ${FIELD_NAME} textValue: value }
  ... on IssueFieldNumberValue       { ${FIELD_NAME} numberValue: value }
  ... on IssueFieldDateValue         { ${FIELD_NAME} dateValue: value }
  ... on IssueFieldSingleSelectValue { ${FIELD_NAME} optionName: name }
  ... on IssueFieldMultiSelectValue  { ${FIELD_NAME} options { name } }
} }`

const GRAPHQL_NAME = /^[_A-Za-z][_0-9A-Za-z]*$/

/** The part of a mapped field name before the first dot (`labels.persona` → `labels`). */
export function baseField(field: string): string {
  return field.split('.')[0]
}

/** Selection for one `kind: "issue"` name: its reader's, else the bare name; `undefined` if not a GraphQL name. */
export function issuePropertySelection(name: string): string | undefined {
  return issueReader(name)?.select ?? (GRAPHQL_NAME.test(name) ? name : undefined)
}

export interface IssueSelection {
  selection: string
  paginated: IssueConnectionName[]
}

/** The `Issue` selection for a load: the system part plus what the `fieldMappings` read. */
export function buildIssueSelection(fieldMappings: FieldMappings = {}): IssueSelection {
  const parts = new Set(SYSTEM_ISSUE_SELECTION)
  const paginated = new Set<IssueConnectionName>(['subIssues', 'blockedBy', 'blocking'])
  for (const { from } of Object.values(fieldMappings)) {
    if (from.kind === 'issueField') parts.add(ISSUE_FIELD_VALUES_SELECTION)
    if (from.kind !== 'issue') continue
    const name = baseField(from.field)
    const select = issuePropertySelection(name)
    if (select) parts.add(select)
    const connection = issueReader(name)?.paginated
    if (connection) paginated.add(connection)
  }
  return { selection: [...parts].join('\n'), paginated: [...paginated] }
}
