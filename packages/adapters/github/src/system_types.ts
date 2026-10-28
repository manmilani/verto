export interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export interface IssueIdConnection {
  nodes: { id: string }[]
  pageInfo: PageInfo
}

/** One `Issue.issueFieldValues` node, with the per-type `value` aliases of `ISSUE_FIELD_VALUES_SELECTION`. */
export interface GitHubIssueFieldValue {
  field?: { name?: string } | null
  textValue?: string
  numberValue?: number
  dateValue?: string
  optionName?: string
  options?: { name: string }[]
}

/**
 * An issue as fetched: the system part is always selected; everything else only when a
 * `fieldMappings` entry asks for it (DESIGN.md §4.6.4 "Trust the config"), including any
 * scalar `Issue` property not listed here.
 */
export interface GitHubIssue {
  id: string
  title: string
  closed: boolean
  url: string
  createdAt: string
  parent: { id: string } | null
  labels: { nodes: { name: string }[] }
  subIssues: IssueIdConnection
  blockedBy: IssueIdConnection
  blocking: IssueIdConnection
  number?: number
  body?: string | null
  stateReason?: string | null
  updatedAt?: string
  issueType?: { name: string } | null
  assignees?: { nodes: { login: string }[] }
  milestone?: { title: string } | null
  duplicateOf?: { id: string } | null
  relatesTo?: IssueIdConnection
  issueFieldValues?: { nodes: (GitHubIssueFieldValue | null)[] }
  [property: string]: unknown
}

/** Id connections followed past their first page. */
export type IssueConnectionName = 'subIssues' | 'blockedBy' | 'blocking' | 'relatesTo'

// Only ISSUE items are included — DRAFT_ISSUE and PULL_REQUEST items are skipped.
export interface GitHubProjectV2Item {
  issueNodeId: string
  fieldValues: GitHubProjectV2FieldValue[]
}

export type GitHubProjectV2FieldValue =
  | { fieldName: string; kind: 'text'; value: string }
  | { fieldName: string; kind: 'number'; value: number }
  | { fieldName: string; kind: 'date'; value: string }
  | { fieldName: string; kind: 'single_select'; value: string }
  | { fieldName: string; kind: 'iteration'; title: string }
