import type { VertoGraph } from './types.js'
import type { VertoChange } from './changes.js'

/**
 * The shared adapter interface implemented by every tracker-specific adapter.
 *
 * TConfig is typed by each adapter (e.g. VertoConfig from @verto/config).
 * @verto/core is intentionally config-agnostic — it does NOT depend on
 * @verto/config; the config type lives there, not here.
 *
 * Read path:  loadProject(config) → VertoGraph
 *   Adapters return the raw graph only; the host pipeline (@verto/text-parser
 *   runHostPipeline) owns materialize → filter → validate → bundle.
 * Write path: writeBack(config, changes, hooks) → WriteResult  (optional; DESIGN.md §4.6.11)
 */
/**
 * A mapped field the tracker can't provide (DESIGN.md §4.6.4): `key` is the fieldMappings key,
 * `field`/`kind` its configured source, `scope` where it was looked up.
 */
export interface MissingField {
  key: string
  field: string
  kind: string
  scope: string
  reason: 'missing' | 'unsupported'
  suggestedKinds: string[]
}

/** What a write asks the user before changing the tracker's setup (one line per item). */
export interface WriteConfirmation {
  /** Fields to register in the tracker, e.g. "priority: number". */
  register: string[]
  /** fieldMappings entries to add to the workspace config, e.g. "priority ← issueField priority". */
  addMappings: string[]
}

export interface WriteHooks {
  /** Resolves true when the user agrees; on false the changes that need it fail. */
  confirm(request: WriteConfirmation): Promise<boolean>
}

export interface WriteResult {
  /** Changes not written, with why. Every other change was written. */
  failed: { change: VertoChange; error: string }[]
  /** Temp id → tracker id of each created ticket. */
  createdIds: Record<string, string>
  /** fieldMappings entries the host adds to the workspace config (default write mappings used). */
  addMappings: Record<string, unknown>
}

export interface VertoAdapter<TConfig = unknown> {
  /** Load the full project graph from the tracker. */
  loadProject(config: TConfig): Promise<VertoGraph>

  /**
   * The load-time field check (§4.6.4): mapped fields that can't be read. The host lets the user
   * skip these entries (dropped from the config before loadProject) or cancel the load.
   */
  checkFields?(config: TConfig): Promise<MissingField[]>

  /** Panel title for this project; the host falls back to the adapter id. */
  projectTitle?(config: TConfig): Promise<string>

  /**
   * Workflow status option names from the tracker board (for status-universe sufficiency).
   * Return [] when not applicable (e.g. repository scope or unsupported adapter).
   */
  fetchStatusOptions?(config: TConfig): Promise<string[]>

  /**
   * Field bindings for display-status sufficiency, tooltips, and priority hints.
   * Shape matches `fieldMappings` in workspace config; undefined when absent.
   */
  fieldMappings?(config: TConfig): Record<string, unknown> | undefined

  /**
   * Edit-time check (§4.6.11): why `change` can't be written to this tracker, or null, including a
   * conflict with another change in `draft`. No writes. Missing tracker fields are not a reason (a write
   * offers to register them).
   */
  checkChange?(config: TConfig, change: VertoChange, draft: VertoChange[]): Promise<string | null>

  /**
   * Write the draft to the tracker (§4.6.11): everything it can, reporting each change it couldn't.
   * Adapters without it keep the draft as a local preview.
   */
  writeBack?(config: TConfig, changes: VertoChange[], hooks: WriteHooks): Promise<WriteResult>
}
