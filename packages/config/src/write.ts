import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parse as parseJsonc } from 'comment-json'
import { validateVertoConfig } from './schema.js'
import type { VertoConfig } from './types.js'
import { extractLeadingComments, stringifyVertoConfig } from './format.js'

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** Key-level merge for a VertoConfig patch into a parsed JSONC object. */
export function applyConfigPatch(target: Record<string, unknown>, patch: Partial<VertoConfig>): void {
  if (patch.adapter !== undefined) {
    target.adapter = patch.adapter
  }

  if (patch.ui !== undefined) {
    if (!isPlainObject(target.ui)) {
      target.ui = {}
    }
    const targetUi = target.ui as Record<string, unknown>
    if (patch.ui.displayStatusGroups !== undefined) {
      targetUi.displayStatusGroups = patch.ui.displayStatusGroups
    }
  }

  // Adapter blocks (any other object-valued key): merged per key, fieldMappings per entry.
  for (const [name, block] of Object.entries(patch as Record<string, unknown>)) {
    if (name === 'ui' || !isPlainObject(block)) continue
    if (!isPlainObject(target[name])) {
      target[name] = {}
    }
    const targetBlock = target[name] as Record<string, unknown>

    for (const [key, value] of Object.entries(block)) {
      if (key === 'fieldMappings' && isPlainObject(value)) {
        if (!isPlainObject(targetBlock.fieldMappings)) {
          targetBlock.fieldMappings = {}
        }
        Object.assign(targetBlock.fieldMappings as Record<string, unknown>, value)
      } else {
        targetBlock[key] = value
      }
    }
  }
}

export async function readVertoConfigRawFile(path: string): Promise<Record<string, unknown>> {
  const contents = await readFile(path, 'utf8')
  return parseJsonc(contents) as Record<string, unknown>
}

/** True when workspace file contains audit-seeded fieldMappings (setup complete). */
export function isWorkspaceSetupComplete(raw: Record<string, unknown>): boolean {
  const github = raw.github
  if (!isPlainObject(github)) return false
  const mappings = github.fieldMappings
  if (!isPlainObject(mappings)) return false
  return Object.keys(mappings).length >= 1
}

export async function writeVertoConfigFile(path: string, content: VertoConfig): Promise<void> {
  validateVertoConfig(content)
  await mkdir(dirname(path), { recursive: true })
  const text = stringifyVertoConfig(content as unknown as Record<string, unknown>)
  await writeFile(path, text, 'utf8')
}

export async function mergeIntoJsoncFile(path: string, patch: Partial<VertoConfig>): Promise<void> {
  let leadingComments = ''
  let target: Record<string, unknown>
  try {
    const contents = await readFile(path, 'utf8')
    leadingComments = extractLeadingComments(contents)
    target = parseJsonc(contents) as Record<string, unknown>
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      target = {}
    } else {
      throw err
    }
  }

  applyConfigPatch(target, patch)
  validateVertoConfig(target)
  await mkdir(dirname(path), { recursive: true })
  const text = `${leadingComments}${stringifyVertoConfig(target)}`
  await writeFile(path, text, 'utf8')
}
