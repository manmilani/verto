// ---------------------------------------------------------------------------
// Scalar / value types
// ---------------------------------------------------------------------------

/**
 * Progress state of a node.
 * NOTE: Just for context and clarity, not for exact mapping or usage going forward. The deprecated canvas's states mapping:
 *            - "done" or "Implemented":  'Closed'
 *            - "In progress":            'Implementing' | 'To_Verify' | 'Verifying'
 *            - "Spec'd - not built":     'To_Plan' | 'Planning' | 'To_Implement'
 *            - "Black box":              'Draft' | 'To_Specify' | 'Specifying'
 *
 *            - "partial": Represented by percentage of child+self issues that are in 'Closed' state. E.g. an open issue node with 3 child issues, of which 2 are 'Closed' and 1 is not 'Closed', would be considered 2/(1+3) = 50% done (and thus 'partial' in the old canvas).
 */
export type Status =  'Draft'         |
                      'To_Specify'    | 'Specifying'   |   // [Includes Mandatory Review]  Specification of what needs to be done (requirements), with acceptance criteria, definition of done, etc.
                      'To_Plan'       | 'Planning'     |   // [Includes Mandatory Review]  Planning the work. Produces an Implementation Plan documentation section in issue body, and possible breakdown into sub-issues.
                      'To_Implement'  | 'Implementing' |   // [Includes Mandatory Review]  Implementation of the work, when not blocked by any dependencies/prerequisites. Implementation may be done on a feature branch, but must be merged back to Main branch with --fast-forward-only before verification.
                      'To_Verify'     | 'Verifying'    |   // [May Include Merge Review]   Integration into Main branch, and then Verifying the work (QA, Unit/System/Integration Testing). Verification may ONLY be done on Main branch after merge. Non-fast-forward merges MUST be reviewed.
                      'Closed';

/**
 * Resolution of a node. Only meaningful when status is 'Closed' — captures why it's closed.
 */
export type Resolution = 'Done/Resolved' | 'Duplicate' | 'Won\'t Do' | 'Obsolete';

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

export interface VertoNode {
  /** Stable adapter-scoped identifier (e.g. GitHub issue node ID, Beans NanoID). */
  id: string;

  /** Human-readable short title. */
  title: string;

  /** Current progress state. */
  status: Status;

  /** Resolution of the node. Only meaningful when status is 'Closed'. */
  resolution?: Resolution;

  /**
   * Long-form description. May contain markdown task lists (`- [ ]`).
   * Display only — completely ignored by all NCN/TOC algorithms.
   */
  body?: string;

  /**
   * True when this node is designated as a deliverable vertical slice
   * (deployable, standalone-value slice — same concept as epic / journey).
   * Semantic designation only; does not change graph structure or algorithm behaviour.
   * NOTE: how the adapter detects this (epic issue type, label, custom field, …) is specified
   * in the adapter contract, not here. This is just a boolean flag for core algorithms to know about.
   */
  isDeliverableVertical: boolean;

  /** Issue type, if available from the adapter (e.g. Epic, Story, Task, Bug, etc) — for potential future use in algorithms and/or display (e.g. different shapes or colors for different issue types). */
  type?: string;

  /**
   * Priority of this node (1–9; see `Priority` type). Required on all nodes; default 5.
   * Feeds the global priority ranking algorithm — see DESIGN.md §3.5.
   */
  priority: Priority;

  /**
   * Unified list of IDs of all prerequisite nodes (dependencies) of this node, for core algorithms to easily access all necessary-condition relationships.
   * including all dependency relationships (parent/child (child blocks parent) and BlockedBy/Blocking edges).
   */
  prereqIds: string[]; // required field for core algorithms — captures all necessary-condition relationships, including both parent-child and blocking relationships.

  /** IDs of child nodes, for whom this node is a parent. */
  childIds: string[];  // captures only parent-child necessary-condition relationships, for convenience of calculating vertical completion percentage and for potential UI distinction.

  // // -- Vertical-only narrative (populated when isVertical = true) -------------
  // /**
  //  * Who this vertical is for (persona / user role).
  //  * TODO: decide whether this is a structured field or parsed from body template.
  //  */
  // persona?: string;
  // /**
  //  * What completing this vertical achieves (outcome narrative).
  //  * TODO: decide whether this is a structured field or parsed from body template.
  //  */
  // outcome?: string;

  // -- NOTE: The following additional fields are for display and filtering only (for now), not used by core algorithms --------------
  assignee?: string;          // assignee
  // estimate?: number;          // effort (if feeds ordering — decide first)
  labels: string[];          // labels or tags, if available from the adapter
  created_at?: string;        // ISO 8601 timestamp, if available from the adapter
  updated_at?: string;        // ISO 8601 timestamp, if available from the adapter
  // iterationId?: string;     // sprint / iteration / milestone
  externalUrl?: string;       // link back to the source ticket

  /** AI-assisted SDLC metadata — traceability and model performance tracking. */
  ai_sdlc?: VertoNodeAISDLCMetadata;
}

// ---------------------------------------------------------------------------
// AI SDLC metadata
// ---------------------------------------------------------------------------

/**
 * AI-assisted software development lifecycle metadata for a node.
 * Captures traceability (who/what contributed at each phase) and token usage
 * for potential future analysis of AI-assisted specification, planning,
 * implementation, and verification quality.
 */
export interface VertoNodeAISDLCMetadata {
  specified_by?: string[];      // Author(s) or AI chat session IDs that contributed to specification (writing/reviewing the issue body, acceptance criteria, etc).
  planned_by?: string[];        // Author(s) or AI chat session IDs that contributed to planning (writing/reviewing the implementation plan, breaking down into sub-issues, etc).
  implemented_by?: string[];    // Author(s) or AI chat session IDs that contributed to implementation (commits, PRs, code reviews, etc).
  verified_by?: string[];       // Author(s) or AI chat session IDs that contributed to verification (QA, testing, etc).

  ai_tokens_estimate?: number;  // Estimated AI agent tokens to specify, plan, implement, and verify this node. Set when planning is done; must be present before transitioning to 'To_Implement'; never updated after that.
  ai_tokens_used?: number;      // Actual AI agent tokens used across the full lifecycle. Updated throughout; finalised when node is Closed.

  ai_model_worker?: string[];   // Recommended AI models for doing the work (planning & implementation), based on node attributes and historical performance on similar nodes.
  ai_model_reviewer?: string[]; // Recommended AI models for reviewing the work (code review, testing & validation), based on node attributes and historical performance on similar nodes.
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
   * Why is the nature of the relationship this edge represents — metadata only;
   * Core algorithms treat all edges as the same kind of necessary-condition relationship, but
   * 'child' nodes are also used in calculating the completion percentage of parent nodes, and
   * may be visually distinguished in the UI (e.g. with a different color edge or a different shape node).
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
  // derived / pre-computed — to be specified
  implementationOrder?: string[];  // ordered node ids
  readyIds?: string[];
  /**
   * Per-node leverage score: maps node id → count of nodes that transitively depend on it (sit above it).
   * In TOC terms this is the node's constraint score — higher = bigger blocker on overall delivery flow.
   * Used for tie-breaking in implementation order and for visual emphasis in the NCN graph lens.
   * See DESIGN.md §3.3.
   */
  leverageScore?: Record<string, number>;
}
