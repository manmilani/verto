export interface FieldMappingEntry {
  from: { kind: 'issue' | 'projectV2'; field: string }
  values?: Record<string, unknown>
  type?: 'text' | 'number' | 'date' | 'select' | 'iteration'
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
  fieldMappings?: FieldMappings
}

export interface PortfolioColumnSourceRule {
  isDone?: boolean
  statuses?: string[]
}

export interface PortfolioColumn {
  label: string
  sources: {
    ticket?: PortfolioColumnSourceRule
    parsed?: PortfolioColumnSourceRule
  }
}

export interface VertoConfig {
  adapter: string
  github: GitHubConfig
  portfolioColumns?: PortfolioColumn[]
}
