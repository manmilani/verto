// ---------------------------------------------------------------------------
// Scalar / value types
// ---------------------------------------------------------------------------

/**
 * Priority of a node. Integer in the range 1–9 (inclusive). Lower = more important.
 *
 * **Load-bearing constraint — do not widen this range.**
 * The global priority ranking algorithm uses base-10 positional encoding: each
 * priority value must occupy exactly one decimal digit. Zero is excluded by design
 * (zero-padding is used for normalisation). Values outside 1–9 must be clamped at
 * the @verto/core boundary (floor to 1, cap to 9). Default: 5.
 *
 * Adapters map tracker-native priority levels (typically 3–5 named levels, e.g.
 * critical=1 / high=3 / medium=5 / low=7 / deferred=9) to values within this range.
 *
 * See DESIGN.md §3.5 for the full global priority ranking algorithm.
 */
export type Priority = number;

// ---------------------------------------------------------------------------
// Core node
// ---------------------------------------------------------------------------

/**
 * The canonical set of VertoNode root property names.
 * Used by the adapter mapper to route fieldMappings entries:
 *   key in CANONICAL_VERTO_NODE_KEYS      →  node[key]               (canonical root)
 *   key not in CANONICAL_VERTO_NODE_KEYS  →  node.ticketFields[key]  (ticket passthrough)
 * Update this set whenever a new canonical field is added to VertoNode.
 */
export const CANONICAL_VERTO_NODE_KEYS = new Set<string>([
  'id', 'title', 'isDone', 'isDeliverySlice',
  'priority', 'prereqIds', 'childIds', 'ticketUrl',
]);

export interface VertoNode {
  /** Stable adapter-scoped identifier (e.g. GitHub issue node ID, Beans NanoID). */
  id: string;

  /** Human-readable short title. */
  title: string;

  /**
   * True when this node is done (closed / completed / cancelled).
   * The canonical "is done" signal for all graph math.
   *
   * isDone(N)  =  N.isDone === true
   * isReady(N) =  !N.isDone && all prereqs satisfy isDone
   *
   * Populated by the system accessor from the tracker's native done/closed field:
   *   GitHub: native `closed: boolean` issue field (always present).
   * Can be overridden via a standard fieldMappings entry when a tracker lacks a
   * native boolean closed field (e.g. derive from status values):
   *   { "from": { "kind": "projectV2", "field": "Status" }, "values": { "Done": true } }
   */
  isDone: boolean;

  /**
   * True when this node is designated as a delivery slice
   * (deployable, standalone-value slice — same concept as epic / journey / vertical).
   * Semantic designation only; does not change graph structure or algorithm behaviour.
   *
   * Default behaviour (system accessor): true when the ticket has no parent
   * (parent is null or empty) — i.e. top-level tickets are delivery slices by default.
   *
   * Override via a standard fieldMappings entry to use issue type instead:
   *   { "from": { "kind": "issue", "field": "type" }, "values": { "Epic": true } }
   * When a fieldMappings entry is present, it fully replaces the system-accessor default.
   */
  isDeliverySlice: boolean;

  /**
   * Priority of this node (1–9; see Priority type). Required on all nodes; default 5.
   * Feeds the global priority ranking algorithm — see DESIGN.md §3.5.
   */
  priority: Priority;

  /**
   * Unified list of all prerequisite node IDs (necessary conditions).
   * Includes both parent-child and blocking relationships.
   * Used by: closureFor, isReady, leverageScore, globalPriorityRanking, implementationOrder.
   */
  prereqIds: string[];

  /**
   * IDs of child nodes for whom this node is a parent.
   * Subset of prereqIds (parent-child edges only); used for delivery completeness
   * percentage and Delivery Map display.
   */
  childIds: string[];

  /**
   * Ticket fields that do not map to a canonical VertoNode property.
   * Populated by the mapper from fieldMappings entries whose key is not in
   * CANONICAL_VERTO_NODE_KEYS. Values are type-coerced by the mapper using the
   * field's declared `type` hint in config. Not used by @verto/core algorithms.
   *
   * Previously-canonical fields now configured here via fieldMappings:
   *   status?: string         — ticket progress state (raw tracker values)
   *   body?: string           — long-form description / markdown
   *   type?: string           — issue type (Epic, Story, Task, Bug, etc.)
   *   assignee?: string       — assigned user
   *   labels?: string[]       — labels or tags
   *   created_at?: string     — ISO 8601 creation timestamp
   *   updated_at?: string     — ISO 8601 last-updated timestamp
   *   stateReason?: string    — GitHub native stateReason (completed / not_planned / duplicate / reopened / null )
   *
   * AI SDLC traceability and model tracking (recommended fieldMappings key names):
   *   specified_by?: string[]      — session IDs / authors who contributed to specification
   *   planned_by?: string[]        — session IDs / authors who contributed to planning
   *   implemented_by?: string[]    — session IDs / authors who contributed to implementation
   *   verified_by?: string[]       — session IDs / authors who contributed to verification
   *   ai_tokens_estimate?: number  — estimated AI tokens for the full lifecycle
   *   ai_tokens_used?: number      — actual AI tokens used across the full lifecycle
   *   ai_model_worker?: string[]   — recommended models for doing the work
   *   ai_model_reviewer?: string[] — recommended models for reviewing the work
   */
  ticketFields?: Record<string, unknown>;

  /**
   * URL of the ticket in the tracker.
   */
  ticketUrl?: string;
}

// ---------------------------------------------------------------------------
// Dependency edge
// ---------------------------------------------------------------------------

/**
 * A directed necessary-condition edge: `from` is a prerequisite for `to`.
 * (Equivalently: `to` is blocked by `from`.)
 */
export interface VertoEdge {
  from: string;  // prereq node id
  to:   string;  // dependent node id

  /**
   * Nature of the relationship — metadata only.
   * Core algorithms treat all edges as the same necessary-condition relationship.
   * 'parent-child' edges are also used for delivery completeness % and may be
   * visually distinguished in the UI.
   */
  reason: 'parent-child' | 'blocking' | string;
}

// ---------------------------------------------------------------------------
// Graph and bundle
// ---------------------------------------------------------------------------

/** The full graph loaded by an adapter. Input to all @verto/core algorithms. */
export interface VertoGraph {
  nodes: VertoNode[];
  edges: VertoEdge[];
}

/**
 * The computed, view-ready bundle passed from the extension host to the webview.
 * Produced by running @verto/core algorithms over a VertoGraph.
 */
export interface DeliveryMapBundle {
  graph: VertoGraph;
  implementationOrder?: string[];  // ordered node ids
  readyIds?: string[];
  /**
   * Per-node leverage score: maps node id → count of nodes that transitively depend on it.
   * In TOC terms this is the node's constraint score — higher = bigger blocker on delivery flow.
   * Used for tie-breaking in implementation order and visual emphasis in the NCN graph lens.
   * See DESIGN.md §3.3.
   */
  leverageScore?: Record<string, number>;
}
