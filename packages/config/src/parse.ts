import { readFile } from 'node:fs/promises'
import { parse as parseJsonc } from 'comment-json'
import { validateVertoConfig } from './schema.js'
import type { VertoConfig } from './types.js'

export function parseVertoConfig(jsonc: string): VertoConfig {
  const raw = parseJsonc(jsonc, undefined, true)
  return validateVertoConfig(raw)
}

export async function readVertoConfigFile(path: string): Promise<VertoConfig> {
  const contents = await readFile(path, 'utf8')
  return parseVertoConfig(contents)
}
