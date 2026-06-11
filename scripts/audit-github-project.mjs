#!/usr/bin/env node
/**
 * Scope-aware bootstrap that queries a GitHub project or repository and drafts
 * a workspace verto.config.json from the discovered fields.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... node --import tsx/esm scripts/audit-github-project.mjs [--dry-run]
 *
 * Options:
 *   --dry-run   Print the merged config to stdout instead of writing to .vscode/verto.config.json
 *
 * Reads .vscode/verto.config.json (if it exists) for owner/projectNumber/scope.
 * Falls back to the defaults file for scope and owner.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { parseVertoConfig, mergeConfigs } from '@verto/config'
import { graphql } from '@octokit/graphql'

const TOKEN = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PERSONAL_ACCESS_TOKEN
if (!TOKEN) {
  console.error('Missing GITHUB_TOKEN')
  process.exit(1)
}

const dryRun = process.argv.includes('--dry-run')

const gql = graphql.defaults({ headers: { authorization: `token ${TOKEN}` } })

const defaultsPath = 'packages/adapters/github/defaults.verto.config.json'
const workspacePath = '.vscode/verto.config.json'

const defaultsRaw = parseVertoConfig(readFileSync(defaultsPath, 'utf8'))
const workspaceRaw = existsSync(workspacePath)
  ? parseVertoConfig(readFileSync(workspacePath, 'utf8'))
  : {}
const config = mergeConfigs(defaultsRaw, workspaceRaw)

if (config.github.scope === 'project') {
  await auditProjectScope(config)
} else {
  await auditRepositoryScope(config)
}

async function auditProjectScope(config) {
  const ownerField = config.github.ownerType === 'organization' ? 'organization' : 'user'
  const data = await gql(
    `query($owner: String!, $number: Int!) {
      ${ownerField}(login: $owner) {
        projectV2(number: $number) {
          fields(first: 100) {
            nodes {
              __typename
              ... on ProjectV2FieldCommon { name dataType }
              ... on ProjectV2SingleSelectField { options { name } }
            }
          }
        }
      }
    }`,
    { owner: config.github.owner, number: config.github.projectNumber },
  )

  const project = data[ownerField]?.projectV2
  if (!project) {
    console.error('Project not found. Check owner, projectNumber, and ownerType.')
    process.exit(1)
  }

  const fieldMappings = {}
  for (const field of project.fields.nodes) {
    if (!field.name || field.name === 'Title') continue
    const fv = { from: { kind: 'projectV2', field: field.name } }
    if (field.dataType === 'SINGLE_SELECT') fv.type = 'select'
    if (field.dataType === 'NUMBER') fv.type = 'number'
    if (field.dataType === 'DATE') fv.type = 'date'
    if (field.dataType === 'ITERATION') fv.type = 'iteration'
    fieldMappings[field.name.toLowerCase().replace(/\s+/g, '_')] = fv
  }

  if (!fieldMappings.priority) {
    console.warn('[audit] No Priority field found — nodes will default to priority 5')
  }

  const discovered = {
    adapter: 'github',
    github: {
      scope: 'project',
      owner: config.github.owner,
      projectNumber: config.github.projectNumber,
      ...(config.github.ownerType ? { ownerType: config.github.ownerType } : {}),
      fieldMappings,
    },
  }

  const merged = mergeConfigs(defaultsRaw, discovered)
  output(merged)
}

async function auditRepositoryScope(config) {
  const data = await gql(
    `query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        labels(first: 100) {
          nodes { name }
        }
      }
    }`,
    { owner: config.github.owner, name: config.github.repository },
  )

  const repo = data.repository
  if (!repo) {
    console.error('Repository not found. Check owner and repository names.')
    process.exit(1)
  }

  const labels = repo.labels.nodes.map(l => l.name)
  if (labels.length > 0) {
    console.log(`[audit] Available labels (${labels.length}): ${labels.join(', ')}`)
    console.log('[audit] Add labels to github.issueFilter.labels to filter issues by label.')
  }

  console.log('[audit] Issue type: readable per-issue via fieldMappings type → { from: { kind: "issue", field: "type" } }')

  // Flag projectV2 gaps from defaults
  const defaultsMappings = defaultsRaw.github.fieldMappings ?? {}
  const projectV2Gaps = Object.entries(defaultsMappings)
    .filter(([, e]) => e.from.kind === 'projectV2')
    .map(([k]) => k)
  if (projectV2Gaps.length > 0) {
    console.warn(
      `[audit] Excluded ${projectV2Gaps.length} projectV2 fieldMapping(s) not applicable in repository scope: ${projectV2Gaps.join(', ')}`,
    )
  }

  // Build fieldMappings with issue-native entries only (no projectV2)
  const fieldMappings = Object.fromEntries(
    Object.entries(defaultsMappings).filter(([, e]) => e.from.kind === 'issue'),
  )

  const discovered = {
    adapter: defaultsRaw.adapter,
    github: {
      scope: 'repository',
      owner: config.github.owner,
      repository: config.github.repository,
      ...(config.github.issueFilter ? { issueFilter: config.github.issueFilter } : {}),
      fieldMappings,
    },
  }

  output(discovered)
}

function output(config) {
  const json = JSON.stringify(config, null, 2)
  if (dryRun) {
    console.log(json)
  } else {
    if (existsSync(workspacePath)) {
      console.warn(`[audit] Overwriting ${workspacePath} — any hand-edited comments will be lost. Use --dry-run to preview first.`)
    }
    writeFileSync(workspacePath, json, 'utf8')
    console.log(`Written to ${workspacePath}`)
  }
}
