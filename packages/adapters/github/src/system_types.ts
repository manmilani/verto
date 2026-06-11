export interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export interface GitHubIssue {
  id: string
  number: number
  title: string
  body: string | null
  closed: boolean
  stateReason: string | null
  url: string
  createdAt: string
  updatedAt: string
  issueType: { name: string } | null
  labels: { nodes: { name: string }[] }
  assignees: { nodes: { login: string }[] }
  milestone: { title: string } | null
  parent: { id: string } | null
  subIssues: { nodes: { id: string }[]; pageInfo: PageInfo }
  blockedBy: { nodes: { id: string }[]; pageInfo: PageInfo }
  blocking: { nodes: { id: string }[]; pageInfo: PageInfo }
}

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
