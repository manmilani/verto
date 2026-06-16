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
  'status', 'nodeType', 'nodeOrigin', 'personas',
  '_rawReqIds', '_note', '_outcome',               // @verto/text-parser outputs (Phase 2.5)
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
   * Workflow progress label mapped from the tracker via fieldMappings (e.g. GitHub ProjectV2 Status).
   * Optional — undefined when no fieldMappings.status binding exists or scope lacks board fields.
   * Not used in graph math; purely for display and portfolio bucketing.
   * Parsed raw-requirement nodes use 'raw' or 'done' here.
   */
  status?: string;

  /**
   * Whether this node originated from a tracker adapter ('ticket') or was materialized
   * from a RAW_REQ block by @verto/text-parser ('parsed').
   */
  nodeType: 'ticket' | 'parsed';

  /**
   * Provenance of this node — e.g. 'github', 'text-parser'.
   * Stamped by mapper.ts for ticket nodes; by materializeParsedRequirements for parsed nodes.
   */
  nodeOrigin: string;

  /**
   * Personas this node serves. Populated per-issue at map time on any ticket node whose
   * issue carries matching labels or a fieldMappings.personas binding — not gated on
   * isDeliverySlice. GitHub adapter default: extract from labels matching 'persona:<value>'
   * (each contributes <value>); optional fieldMappings.personas overrides label extraction.
   * Always [] on parsed nodes. The Delivery Map slice header (Phase 3) reads this field
   * from the selected slice node — that is a UI concern, not a load-time restriction.
   */
  personas: string[];

  /**
   * IDs of parsed-requirement child nodes created from this ticket's RAW_REQ block.
   * Set to [] on all ticket nodes by the adapter; populated by materializeParsedRequirements
   * in @verto/text-parser. Always [] on parsed nodes themselves.
   */
  _rawReqIds: string[];

  /**
   * Display note for this node in the pipeline.
   * Ticket nodes: first paragraph of the DESC:BEGIN/END block in ticketFields.body,
   *   computed by computeBodyFields() in @verto/text-parser.
   * Parsed nodes: note extracted from the raw requirement line (set by materializeParsedRequirements).
   * Undefined when no DESC block or no note is present.
   */
  _note?: string;

  /**
   * Outcome text for a delivery-slice node's header.
   * Ticket nodes: first paragraph of the DESC:BEGIN/END block in ticketFields.body,
   *   computed by computeBodyFields() in @verto/text-parser (same value as _note).
   * Parsed nodes: always undefined (parsed nodes are not delivery slices).
   * Undefined when no DESC block is present.
   */
  _outcome?: string;

  /**
   * Ticket fields that do not map to a canonical VertoNode property.
   * Populated by the mapper from fieldMappings entries whose key is not in
   * CANONICAL_VERTO_NODE_KEYS. Values are type-coerced by the mapper using the
   * field's declared `type` hint in config. Not used by @verto/core algorithms.
   *
   *   body?: string           — long-form description / markdown; consumed by @verto/text-parser
   *                             (computeBodyFields) to populate _note/_outcome on the node root.
   *                             Stripped by panelManager.ts before sending to the webview.
   *   type?: string           — issue type (Epic, Story, Task, Bug, etc.)
   *   assignee?: string       — assigned user
   *   labels?: string[]       — labels or tags
   *   created_at?: string     — ISO 8601 creation timestamp
   *   updated_at?: string     — ISO 8601 last-updated timestamp
   *   stateReason?: string    — GitHub native stateReason (completed / not_planned / duplicate / reopened / null)
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
   * URL of the ticket in the tracker. Required on all nodes.
   * Ticket nodes: native issue URL. Parsed nodes: parent ticketUrl + '#raw-req-{n}'.
   */
  ticketUrl: string;
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
  reason: 'parent-child' | 'blocking' | 'parsed-req';
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
 *
 * All computed fields are populated by buildDeliveryMapBundle() in @verto/core.
 * The webview is a dumb view and does NOT recompute any of these fields.
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
  /**
   * Per-node global priority ranking value (lower = higher priority / do first).
   * Derived by the chain-traversal algorithm — see DESIGN.md §3.5.
   * Computed server-side by buildDeliveryMapBundle(); not recomputed in the webview.
   */
  globalPriorityRanking?: Record<string, number>;
  /**
   * Per-node delivery completeness: maps node id → ratio of isDone nodes in its
   * transitive prerequisite closure (0 = nothing done, 1 = fully delivered).
   * Computed server-side by buildDeliveryMapBundle(); not recomputed in the webview.
   * See DESIGN.md §3.3.
   */
  deliveryCompleteness?: Record<string, number>;
}
