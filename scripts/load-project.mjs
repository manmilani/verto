#!/usr/bin/env node
/**
 * Loads Verto's GitHub project and prints the DeliveryMapBundle as JSON.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... node --import tsx/esm scripts/load-project.mjs [--no-parsed]
 *
 * Requires pnpm build before running (packages must be in dist/).
 * All nodes will show priority 5 — Verto's board has no Priority column.
 */

import { readFileSync } from 'node:fs'
import { parseVertoConfig, readVertoConfigFile, mergeConfigs } from '@verto/config'
import { GitHubAdapter } from '@verto/adapter-github'
import { runHostPipeline } from '@verto/parsed-nodes'

const TOKEN = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PERSONAL_ACCESS_TOKEN
if (!TOKEN) {
  console.error('Missing GITHUB_TOKEN')
  process.exit(1)
}

const defaults = parseVertoConfig(
  readFileSync('packages/adapters/github/defaults.verto.config.jsonc', 'utf8'),
)
const workspace = await readVertoConfigFile('.vscode/verto.config.jsonc')
const config = mergeConfigs(defaults, workspace)

const adapter = new GitHubAdapter(TOKEN)
const graph = await adapter.loadProject(config)
const parsedEnabled = !process.argv.includes('--no-parsed')
const bundle = runHostPipeline(graph, { parsedEnabled })
console.log(JSON.stringify(bundle, null, 2))
