#!/usr/bin/env node
/**
 * Scope-aware bootstrap that queries a GitHub project or repository and drafts
 * a workspace verto.config.jsonc from the discovered fields.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... node --import tsx/esm scripts/audit-github-project.mjs [--dry-run]
 *
 * Options:
 *   --dry-run   Print the merged config to stdout instead of writing to .vscode/verto.config.jsonc
 *
 * Reads .vscode/verto.config.jsonc (if it exists) for owner/projectNumber/scope.
 * Falls back to the defaults file for scope and owner.
 */

import { readFileSync, existsSync } from 'node:fs'
import { parseVertoConfig, mergeConfigs, writeVertoConfigFile, mergeIntoJsoncFile, stringifyVertoConfig } from '@verto/config'
import { auditProjectScope, auditRepositoryScope } from '@verto/adapter-github'

const TOKEN = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PERSONAL_ACCESS_TOKEN
if (!TOKEN) {
  console.error('Missing GITHUB_TOKEN')
  process.exit(1)
}

const dryRun = process.argv.includes('--dry-run')

const defaultsPath = 'packages/adapters/github/defaults.verto.config.jsonc'
const workspacePath = '.vscode/verto.config.jsonc'

const defaultsRaw = parseVertoConfig(readFileSync(defaultsPath, 'utf8'))
const workspaceRaw = existsSync(workspacePath)
  ? parseVertoConfig(readFileSync(workspacePath, 'utf8'))
  : {}
const config = mergeConfigs(defaultsRaw, workspaceRaw)

const workspaceExists = existsSync(workspacePath)

let result
const auditOptions = { seedRepoDefaults: !workspaceExists }
if (config.github.scope === 'project') {
  result = await auditProjectScope(TOKEN, config, auditOptions)
} else {
  result = await auditRepositoryScope(TOKEN, config, auditOptions)
}

for (const w of result.warnings) {
  console.warn(`[audit] ${w}`)
}

const merged = mergeConfigs(config, result.discovered)

if (dryRun) {
  console.log(stringifyVertoConfig(merged))
} else if (workspaceExists) {
  await mergeIntoJsoncFile(workspacePath, merged)
  console.log(`Merged audit into ${workspacePath}`)
} else {
  await writeVertoConfigFile(workspacePath, merged)
  console.log(`Written to ${workspacePath}`)
}
