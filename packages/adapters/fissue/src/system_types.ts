/**
 * The part of fissue's extension/core API this adapter uses (fissue DESIGN.md §7), declared
 * structurally so Verto has no package dependency on fissue (DESIGN.md §4.6.10).
 */

/** A raw frontmatter value as fissue reads it. */
export type FissueRaw = string | null | FissueRaw[] | { [key: string]: FissueRaw }

export type FissueFieldType = 'text' | 'number' | 'boolean' | 'date' | 'select'

export interface FissueFieldDef {
  kind?: string
  type: FissueFieldType
  isArray: boolean
  options?: { name: string }[]
}

export interface FissueProjectConfig {
  prefix: string
  fields: Record<string, FissueFieldDef>
}

export interface FissueStateTicket {
  id: string
  file: string
  /** Absolute path of the ticket file. */
  path: string
  values: Record<string, FissueRaw>
  /** The Markdown body; present when asked for with `{ bodies: true }`. */
  body?: string
}

export interface FissueWarning {
  message: string
  file?: string
}

export interface FissueProjectState {
  config: FissueProjectConfig
  tickets: FissueStateTicket[]
  warnings: FissueWarning[]
}

/** A value as fissue's write operations take it. */
export type FissueInput = string | number | boolean | null | (string | number | boolean)[]

export interface FissueUpdateInput {
  set?: Record<string, FissueInput>
  add?: Record<string, FissueInput>
  remove?: Record<string, FissueInput>
}

export interface FissueApiV1 {
  apiVersion: number
  projectState(root: string, opts?: { bodies?: boolean }): Promise<FissueProjectState>
  findProjectRoot(dir: string): Promise<string | null>
  updateTicket(root: string, ref: string, input: FissueUpdateInput): Promise<{ id: string; changed: boolean }>
  createTicket(root: string, values: Record<string, FissueInput>): Promise<{ id: string }>
  addField(root: string, name: string, def: Record<string, unknown>): Promise<{ changed: boolean }>
}

export const FISSUE_API_VERSION = 1
