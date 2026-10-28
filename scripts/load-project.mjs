#!/usr/bin/env node
/**
 * Loads the workspace's project (any adapter) and prints the DeliveryMapBundle as JSON.
 * Uses the extension host's own config loading, registry and pipeline (field check and skip,
 * parsed fieldMappings, title).
 *
 * Usage:
 *   node --import tsx/esm scripts/load-project.mjs [--no-parsed] [--workspace <dir>] [--fissue-core <path>]
 *
 *   --workspace    folder whose .vscode/verto.config.jsonc is read (default: cwd)
 *   --fissue-core  fissue's built core (default: ../fissue/packages/core/dist/index.js from the repo root)
 *   Requires Node >= 20.19 (the host modules require the ESM @verto/* packages).
 *   GITHUB_TOKEN   required only for the GitHub adapter
 *
 * Requires pnpm -r build before running (packages must be in dist/).
 */

import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadWorkspaceConfig } from '../packages/extension/src/host/workspaceConfig.ts'
import { runPipeline, formatSkippedFields } from '../packages/extension/src/host/loadPipeline.ts'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function option(name, fallback) {
  const i = process.argv.indexOf(name)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const workspaceFolder = resolve(option('--workspace', process.cwd()))
const fissueCoreArg = option('--fissue-core', undefined)
const fissueCore = fissueCoreArg ? resolve(fissueCoreArg) : resolve(repoRoot, '../fissue/packages/core/dist/index.js')

const env = {
  workspaceFolder,
  async getGitHubToken() {
    const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PERSONAL_ACCESS_TOKEN
    if (!token) throw new Error('Missing GITHUB_TOKEN')
    return token
  },
  async getFissueApi() {
    if (!existsSync(fissueCore)) {
      throw new Error(`fissue core not found at ${fissueCore}; build fissue first (pnpm -C ../fissue build) or pass --fissue-core <path>`)
    }
    return (await import(pathToFileURL(fissueCore).href)).api
  },
}

try {
  const config = await loadWorkspaceConfig(workspaceFolder)
  const parsedEnabled = !process.argv.includes('--no-parsed')
  const { bundle, projectName, skipped } = await runPipeline(config, env, parsedEnabled)
  if (skipped.length > 0) console.warn(formatSkippedFields(skipped))
  console.warn(`Project: ${projectName}`)
  console.log(JSON.stringify(bundle, null, 2))
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
