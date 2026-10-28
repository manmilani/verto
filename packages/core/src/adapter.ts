import type { VertoGraph } from './types.js'

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
 * Write path: writeBack(changes)  → void  (optional; Phase 5)
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

export interface VertoAdapter<TConfig = unknown> {
  /** Load the full project graph from the tracker. */
  loadProject(config: TConfig): Promise<VertoGraph>

  /**
   * The load-time field check (§4.6.4): mapped fields that can't be read. The host drops
   * these entries from the config before loadProject and tells the user.
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
   * Write changes (priority overrides, status updates, new blocking links, etc.)
   * back to the tracker. Optional — adapters may omit this until Phase 5.
   * The exact shape of `changes` is defined per-adapter when write-back is designed.
   */
  writeBack?(changes: unknown): Promise<void>
}
