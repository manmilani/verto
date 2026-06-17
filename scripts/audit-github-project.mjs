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

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { parseVertoConfig, mergeConfigs } from '@verto/config'
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

let result
if (config.github.scope === 'project') {
  result = await auditProjectScope(TOKEN, config)
} else {
  result = await auditRepositoryScope(TOKEN, config)
}

for (const w of result.warnings) {
  console.warn(`[audit] ${w}`)
}

const merged = mergeConfigs(config, result.discovered)
output(merged)

function output(cfg) {
  const json = JSON.stringify(cfg, null, 2)
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
