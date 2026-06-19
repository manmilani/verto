export interface FieldMappingEntry {
  from: { kind: 'issue' | 'projectV2'; field: string }
  values?: Record<string, unknown>
  type?: 'text' | 'number' | 'boolean' | 'date' | 'select' | 'iteration'
  isArray?: boolean
}

export type FieldMappings = Record<string, FieldMappingEntry>

export interface GitHubIssueFilter {
  labels?: string[]
  states?: ('OPEN' | 'CLOSED')[]
  milestone?: string
  assignee?: string
}

type GitHubScopeVariant =
  | { scope: 'project'; owner: string; projectNumber: number }
  | { scope: 'repository'; owner: string; repository: string; issueFilter?: GitHubIssueFilter }

export type GitHubConfig = GitHubScopeVariant & {
  ownerType?: 'user' | 'organization'
  includeClosedAncestors?: boolean
  fieldMappings?: FieldMappings
}

export interface DisplayStatusGroupSourceRule {
  statuses: string[]
}

export interface DisplayStatusGroup {
  label: string
  sources: {
    ticket?: DisplayStatusGroupSourceRule
    parsed?: DisplayStatusGroupSourceRule
  }
}

export interface UiConfig {
  displayStatusGroups?: DisplayStatusGroup[]
}

export interface VertoConfig {
  adapter: string
  github?: GitHubConfig
  ui?: UiConfig
}
