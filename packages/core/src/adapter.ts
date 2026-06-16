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
export interface VertoAdapter<TConfig = unknown> {
  /** Load the full project graph from the tracker. */
  loadProject(config: TConfig): Promise<VertoGraph>

  /**
   * Write changes (priority overrides, status updates, new blocking links, etc.)
   * back to the tracker. Optional — adapters may omit this until Phase 5.
   * The exact shape of `changes` is defined per-adapter when write-back is designed.
   */
  writeBack?(changes: unknown): Promise<void>
}
