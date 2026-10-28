# Verto — Design & Thinking Document

> **Status:** Living draft. This document captures our current thinking about
> **Verto** — a project-management tool for vertical-slice delivery from your
> issue graph. It is the evolving picture of **why** we are building it, **what**
> it should achieve, and **how** we intend to build it. Sections will be expanded
> and revised as decisions solidify.

> **Paths:** Unless stated otherwise, all file and folder paths in this document
> are **relative to the Verto project root** (the folder containing this file).
> See [README.md](./README.md) for the repository layout.

> **Current design only.** Retired and rejected designs, the project's origin and
> resolved knowledge gaps are recorded in [DESIGN-History.md](./DESIGN-History.md).

---

## Table of Contents

1. [Background](#1-background)
2. [Verto — System Intention / Goal](#2-verto--system-intention--goal)
3. [High-Level Abstract Solution Design](#3-high-level-abstract-solution-design)
4. [Solution System Design](#4-solution-system-design) — adapter architecture: [§4.6.1](#461-canonical-vs-tracker-native-models)–[§4.6.10](#4610-second-adapter-fissue)
5. [Knowledge Gaps](#5-knowledge-gaps)
6. [Implementation Plan](#6-implementation-plan)

---

## 1. Background

Verto grew out of a single-project Cursor canvas, the *Rustybu Vertical Delivery
Map*, which modelled one product both as **vertical journeys** and as a
**necessary-conditions graph**. It validated Verto's core ideas: computing readiness
and leverage, and turning a human priority ordering into a concrete,
dependency-respecting delivery sequence. Its implementation was bespoke (inline data,
two hand-aligned models, canvas-only runtime) and is not a specification.

The canvas's story, its role during migration (Phases 0–4) and how its concepts map
onto Verto's model are in [DESIGN-History.md](./DESIGN-History.md) §1–§2. A verbatim
copy is kept in [`deprecated_original_canvas/`](./deprecated_original_canvas/) for
reference only and will eventually be removed; where it and this document disagree,
this document wins.

---

## 2. Verto — System Intention / Goal

This section is about **the problem we are solving and the effect we want to
achieve** — not about mechanisms. Everything here is the **compass** for design
decisions in later sections and later phases. When a design choice is unclear, it
should be resolved in favour of whatever best serves the intentions below.

### 2.1 The one-sentence north star

> **Verto aims to make it as easy, simple, and easily
> understandable as possible to make the most optimised, value-adding progress in
> developing a product — by enabling a project/product manager to define, break
> down, prioritise, and deliver the most impactful, self-sufficient deliverable
> slices (verticals) of the product's features, with minimum effort and maximum
> clarity.**

### 2.2 The problems we are targeting

1. **Loss of the big picture.** As products grow, it becomes hard to see what the
   product actually *is*, what is genuinely done, and what only looks done.
   Status is scattered across tickets, docs, and people's heads.
2. **Hidden dependencies and wasted effort.** Teams build things that cannot yet
   deliver value because an unseen prerequisite is missing, or they build
   low-leverage items while high-leverage enablers wait. The *order* of work is
   often accidental rather than optimised.
3. **Hard-to-answer "what should we do next?"** Prioritisation is usually a flat
   list divorced from dependency reality. Saying "this journey matters most"
   rarely translates automatically into "therefore build these items, in this
   order."
4. **Slicing the product into value is hard.** Identifying *self-sufficient
   vertical slices* — each of which delivers real, end-to-end value — requires
   reasoning that most tools don't support.
5. **High effort, low clarity.** Existing tools (issue trackers, roadmaps) hold
   the raw data but don't *think* about it: they don't surface readiness,
   leverage, or the consequences of a priority choice. Producing the clear
   picture is manual and quickly goes stale.

### 2.3 The effects we want to achieve

- **Clarity with minimum effort.** A PM/PO should *see* the product's true state
  and structure almost for free, continuously, without manually maintaining a
  separate picture.
- **Optimised, value-first sequencing.** The system should make the
  highest-value, dependency-correct next steps obvious — exploiting the real
  constraints rather than ignoring them.
- **Vertical thinking made easy.** Defining a vertical, breaking it into the work
  that *necessarily* enables it, and seeing what's left to deliver it should be
  natural and low-friction.
- **Decisions that propagate.** Expressing intent at the journey level (e.g.
  "this vertical is our top priority") should automatically produce the concrete,
  ordered work plan that follows from it.
- **Truth that lives where the work lives.** The picture should be derived from
  the team's real tickets/backlog, so it is always current and shared — not a
  side artifact that drifts.
- **Understandable to humans.** The output must be legible to a person at a
  glance: which slices, what's blocking them, what to do first, and why.

### 2.4 What success looks like

- A manager can define verticals and decompose them with little ceremony.
- At any moment, the tool answers: *What's truly done? What's ready to start now?
  What unblocks the most? If I prioritise vertical X, what exactly do I build, and
  in what order?*
- Acting on the tool's recommended order measurably reduces wasted/blocked work
  and accelerates the delivery of whole, value-adding slices.
- The picture stays accurate with effectively no manual upkeep beyond normal
  ticket hygiene.

### 2.5 Explicit non-goals (for now)

- Not a general-purpose issue tracker; it **augments** trackers, it does not
  replace them.
- Not a Gantt/time-estimation/resourcing tool at this moment (estimates may inform priority
  later, but scheduling by calendar is not the point at the moment).
- Not tied to any one product, vendor, or data source.

---

## 3. High-Level Abstract Solution Design

This section describes the **conceptual model** only — the way we *think about* a
product — independent of any technology, storage, or UI.

### 3.1 One graph; all nodes are equal

The product is modelled as a **single necessary-conditions graph**. Every ticket
is a **node** in that graph. **The system does not treat any node differently
from any other** in terms of graph structure, data shape, or behaviour — all
nodes share (~95%) the same fields, relationships, and algorithms (closure,
readiness, leverage, priority inheritance, implementation order).

**Terminology (equivalent concepts):** *vertical delivery*, *vertical slice*,
*user journey*, and *epic* all refer to the **same thing** — a sufficient,
value-adding product slice. In practice the material representation of that
concept is a **top node** (probably an Epic ticket type), but the term names the
*slice*, not a distinct graph entity type.

**Delivery subgraph (any node).** For **any** node N, the **delivery subgraph**
(rooted subgraph) rooted at N is N together with **all of its direct and indirect
dependencies** — the full transitive dependency closure. This is the
representation of *everything that must be done to deliver N*. It applies
uniformly to every node, not only to verticals/epics. The whole product is the
full graph; focusing on any node defines one such subgraph. Subgraphs overlap
when nodes share dependencies, so the graph is a DAG, not a set of disjoint trees.

**What makes a vertical/epic special (semantic only).** A vertical is not a
different kind of graph node. What distinguishes it is **meaning**, not
structure: it is a product slice that (a) can be **delivered/deployed without
reliance on other slices**, and (b) **adds standalone value for customers**.
That semantic role is why verticals are the natural unit for prioritisation and
for the Delivery map lens — but the underlying graph math is identical for all
nodes.

**Unified dependency links.** Parent/child and BlockedBy/Blocking are the same
*kind* of directed link for all graph and planning purposes: if ticket C is a
child of P, or C blocks P, then **P depends on C** — C is a necessary condition
for P. The *reason* for the link (hierarchical decomposition vs cross-cutting
prerequisite) is semantic metadata only; readiness, closure, leverage, priority
inheritance, and implementation order treat both identically. **Any ticket may
have children**, not only epics.

The **Delivery map** and **NCN graph** are two **presentation lenses** over
this single graph. The Delivery map emphasises nodes designated as verticals;
the NCN graph shows the full network with no special casing.

### 3.2 The product as a graph

- **Nodes** = all tickets, one uniform type in the graph (epics, sub-issues,
  standalone issues — no structural distinction).
- **Directed edges** = **necessary-condition** relationships, unified across
  parent/child and BlockedBy/Blocking. An edge `A → B` means *A must be
  sufficiently done before B can be fully built/delivered*. The full set of
  in-edges to a node is the complete set of its prerequisites.
- **Status** — workflow progress label on the canonical root (`node.status`), mapped
  from the tracker via `fieldMappings` (Phase 2.5). **Not used in graph math** — the
  canonical done signal is `VertoNode.isDone: boolean` (see §4.4).

Modelling shared enablers as a *single* node that many delivery subgraphs depend
on is what makes **leverage** visible: a missing foundational node may block many
nodes (and many verticals) at once.

### 3.3 NCN — Necessary Conditions Network

The graph is a **Necessary Conditions Network**: edges encode *necessity*, not
mere sequence preference. From this structure we derive, for **any node** (the
algorithms are node-agnostic):

- **Closure** — the complete transitive set of prerequisites required to
  deliver a node (that node plus everything it depends on).
- **Readiness** — a node is *ready* when it is not done (`isDone === false`) and
  **all** of its direct prerequisites are done (`isDone === true`). Ready nodes are
  where work can actually start.
- **Leverage score** — the count of nodes that transitively depend on (sit above)
  a given node. In TOC terms this is the node's *constraint score*: a node with a
  high leverage score is acting as a constraint on the overall delivery flow —
  its incompleteness is blocking the most upward value. Completing high-leverage
  nodes first is Verto's operationalisation of TOC's "exploit the constraint" policy.
  High-leverage nodes are the ones whose completion unblocks the most.
- **Delivery completeness** — for any focused node, the **weighted** fraction of its
  delivery subgraph (closure) that is already done: each node in the closure contributes
  `weight` (default **1**); done nodes contribute their full weight. Ratio =
  (sum of weights of done nodes) / (sum of weights of all nodes in closure). With
  default weights this equals the unweighted done-node fraction; future effort
  estimates map to `weight` without changing the algorithm.

### 3.4 TOC — Theory of Constraints as the sequencing philosophy

NCN tells us *what depends on what*; **TOC** tells us *what to do about it*. We
treat delivery as a flow limited by constraints and sequence work to **exploit
the constraint and unblock value fastest**, rather than spreading effort evenly.
Concretely, the abstract policy is:

- Identify what currently constrains the delivery of the prioritised value
  (the missing prerequisites in a prioritised node's closure).
- Prefer work that **relieves those constraints** and unblocks the most
  upward value (leverage score), subject to dependency order.
- Avoid investing in items that do not move a prioritised node closer to
  deliverable.

This is the conceptual basis for the "what to build next / in what order"
behaviour; the precise algorithm lives in the system-design section.

### 3.5 Prioritisation model

Every node carries a numeric `priority` field (see [`packages/core/src/types.ts`](./packages/core/src/types.ts)). Priority is a direct, explicit property of **every node** — not a separate per-vertical ranking list. A single graph-wide algorithm derives a comparable score per node that drives implementation order.

**Priority values — a load-bearing constraint**

Priority is an integer in the range **1–9** (inclusive), where **1 = most important** and **9 = least important**. **Zero is explicitly excluded.** The global priority ranking algorithm uses base-10 positional encoding where each value occupies exactly one decimal digit; values outside 1–9 must be clamped at the `@verto/core` boundary (floor to 1, cap to 9). Adapters map tracker-native priority levels (typically 3–5 named levels such as *critical / high / medium / low / deferred*) to values within this range. **Default: 5.**

**Global priority ranking algorithm**

For each node N, a canonical *global priority ranking value* is derived by traversing upward through the dependency graph (following dependents — nodes that require N to be done) and collecting *result values* along every path:

1. **Traversal** — from N, follow all upward paths through dependents to the top of the graph. Traversal never terminates early.

2. **Result generation** — two triggers produce a result value at depth d along any path:
   - A **DeliverySlice** node is encountered → generate a result for the chain from N up to and including that node.
   - The **top of the path** is reached (node with no further dependents) → generate a result for the full chain. If the top is itself a DeliverySlice, both triggers coincide — one result, not two.

3. **Formula** — for a chain N = n₀, n₁, …, nₖ (where nₖ triggered the result):

   `raw score = P(n₀)×10⁰ + P(n₁)×10¹ + … + P(nₖ)×10ᵏ`

   P(n) is the `priority` value of node n. Higher-depth nodes carry more significant digit positions; nₖ (the topmost node in the chain) is always the most significant digit.

4. **Normalisation** — all raw scores across the entire graph are right-padded with zeros to the same digit count: `D = max(actual_max_depth_in_graph, MIN_DEPTH_FLOOR)`. A score of depth k is normalised by multiplying by `10^(D−k)`. This makes every topmost node's priority the primary sort key regardless of chain length, and ensures scores are comparable across chains of different depths.

5. **Canonical value** — the canonical global priority ranking value of N is the **minimum** of all its normalised results across all chains and all paths. The minimum captures the best (most important) chain N participates in.

**Lower canonical value = higher global priority (do first).**

**`MIN_DEPTH_FLOOR` option (disabled by default)**

A configurable constant `MIN_DEPTH_FLOOR` sets a minimum digit count for normalisation, using `D = max(actual_max_depth, MIN_DEPTH_FLOOR)`. This decouples per-node priority computation from a full graph scan, enabling live priority estimates when adding or reordering nodes without a full graph reload. Default: `undefined` (use actual graph max). Enable when incremental estimation is needed.

### 3.6 Requirements, raw requirements, and graph nodes

**Terminology** — see [§3.8 Glossary](#38-glossary).

Every **Requirement** is a **`VertoNode`** in the graph. Requirements are either:

- **`nodeType: 'ticket'`** — tracked issues from an adapter (e.g. GitHub); `nodeOrigin`
  names the adapter (e.g. `'github'`).
- **`nodeType: 'parsed'`** — lines materialized from a ticket body's **Raw
  Requirements** block (`RAW_REQ:BEGIN` / `RAW_REQ:END`); `nodeOrigin: 'text-parser'`.

Parsed nodes are created by **`@verto/text-parser`** (Phase 2.5) after the tracker
adapter loads ticket nodes. They participate in **NCN math** (closure, readiness,
leverage, implementation order) when **Enable Parsed Requirements** is on.

A slice's Requirements are the **union** of its child sub-issues and its raw
requirement lines — shown as a **single pipeline column** in the Delivery Map (not
two side-by-side columns). There is **no automatic deduplication or linking**
between raw lines and child tickets.

**`_rawReqIds[]`** on a parent lists synthetic ids for that ticket's materialized
raw lines. **`prereqIds`** = `_rawReqIds ∪ childIds ∪ blocking` (deduped).
**`childIds`** remains sub-issue ids only. Parsed → parent edges use
`VertoEdge.reason: 'parsed-req'`.

When **Enable Parsed Requirements** is off (global toggle, default **on**), parsed
nodes are **filtered out** of the graph copy used for `buildDeliveryMapBundle()` —
as if they did not exist — including from the Delivery Map pipeline (children only).

### 3.7 Delivery Map lens (vertical-focused presentation)

The Delivery Map emphasises **delivery-slice** nodes (vertical / epic / journey).

**Slice header:**

- **Persona** — `personas: string[]` (canonical root field; default `[]`). **Population
  (load time):** populated by the standard parsed sub-field mapping `"labels.persona"` —
  see §4.6.4 (parsed sub-field mappings). The GitHub adapter default config includes
  `personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true }`, which extracts all
  `persona:<value>` labels via `@verto/text-parser`. Workspace config may override this
  entry like any other `fieldMappings` entry; if no `personas` entry is present at all,
  `mapper.ts` falls back to direct label extraction. See §4.6.7. **Display (Phase 3
  UI):** the Delivery Map slice header reads `personas` from the selected slice node;
  the field may also be populated on non-slice tickets but is not displayed there.
- **Outcome** — display-only: `node._outcome` on the selected slice node — the
  **first paragraph** of its `DESC:BEGIN` / `DESC:END` block, pre-computed by
  `computeBodyFields` in `@verto/text-parser` (§4.6.8). Read directly from the node;
  do not re-parse the body in the webview (`ticketFields.body` is stripped before
  the `'update'` message).

**Requirement pipeline** — one ordered list per slice, **not** two columns:

1. **Child tickets** (sub-issues) — first segment  
2. **Raw requirement lines** — second segment  

Concatenation only; **no deduplication**. Blocking-only prereqs are **not** shown.
Parsed lines on **child** tickets affect that child's graph only — they do **not**
appear on the parent slice's pipeline (same as sub-sub-issues).

**Ordering.**

| Segment | Sort rule |
|---|---|
| **Child tickets** | (1) `implementationOrder` rank; (2) `created_at` ascending (oldest first; missing → sort last); (3) issue `id` alphanumeric ascending |
| **Raw requirements** | Document order within `RAW_REQ:BEGIN` / `RAW_REQ:END`; ignore `1.`, `2.`, … prefixes |

**Per-requirement display fields** (pipeline row; `title` = `VertoNode.title`):

| Field | Raw requirement (`parsed`) | Child ticket (`ticket`) |
|---|---|---|
| **title** | Parsed from line text (see below) | Issue title |
| **note** | `node._note` (set by `materializeParsedRequirements`) | `node._note` — **first paragraph** of the child's `DESC:BEGIN` / `DESC:END` block, pre-computed by `computeBodyFields` (§4.6.8) |
| **status** | `raw` (unchecked) or `done` (checked) | Tracker `status` (canonical root) |
| **isDone** | Matches checkbox | Tracker closed / mapping |
| **Completeness** | `isDone ? 1 : 0` × `weight` (display as %; default weight 1) | `deliveryCompleteness(nodeId)` (weighted; §3.3) |

**Raw line name/note parsing** (`[ ]` or `[x]`):

- If line matches `- [ ] 1. "Name": Description...` or `- [ ] "Name": Description...`
  (colon immediately after closing `"` of name) → `title` = Name, `note` = rest.
- Else → `title` = `note` = full line text; multiline: `title` = first line,
  `note` = all lines.

**Synthetic identity (parsed nodes):**

- **id:** `{parentId}#raw-req-{n}` — **1-based** index in `RAW_REQ` **document order**
- **ticketUrl:** parent `ticketUrl` + anchor `#raw-req-{n}`
- Reordering body lines **changes ids** — accepted behaviour
- `isDeliverySlice: false`, `priority: 5`

**Slice picker (Phase 3).** Pills.

**Empty states.**

| Situation | UI |
|---|---|
| No `isDeliverySlice` nodes | Empty screen (auto-promote deferred) |
| Slice with no children and toggle off / no raw lines | Empty pipeline |

**Portfolio table, UsageBar, gap callouts (Phase 3 UI).**

- **Portfolio** — per slice, bucket Requirements by display group: system **Done**
  (`isDone`), then user-configured groups from `ui.displayStatusGroups`, then
  **`others`** when the status universe is not fully covered (§4.6.3). Column
  headers show status tooltips (`displayStatusGroupTooltips`).
  **Sort:** delivery slices by `deliveryCompleteness[sliceId]` descending (highest
  completeness first). **Primary user** column — `personas` joined (`' / '`) per slice.
  **Slice picker pills:** completion-toned via `buildTone(deliveryCompleteness)` (Phase 4).
- **UsageBar** — same display-status groups as the portfolio table plus an implicit **`others`** bucket when config does not account for every status in the current **status universe** (§4.6.3); segment value = **sum of `weight`** (default 1) of requirements in that bucket. With default weights this equals a count.
- **Gaps** — pipeline rows with **`!isDone`** (not yet satisfied). Display grouping is separate: a done node always displays as system **Done** regardless of workflow `status`.
**Enable Parsed Requirements** — global setting (all lenses); persisted in
`workspaceState`; default **on**. Host always materializes parsed nodes, then
filters before bundle when off; rebuilds bundle on toggle.

### 3.8 Glossary

| Term | Meaning |
|---|---|
| **Raw Requirements** | Checklist items between `RAW_REQ:BEGIN` / `RAW_REQ:END`; markdown heading **Raw Requirements** |
| **`raw` status** | Unchecked raw requirement (`isDone: false`) |
| **`done` status** | Checked raw requirement (`isDone: true`) |
| **Requirement** | Any pipeline row: a **child ticket** and/or a **raw requirement** line (union, concatenated) |
| **`parsed` `nodeType`** | Graph node materialized from a raw requirement line |
| **`ticket` `nodeType`** | Graph node from a tracker adapter |
| **`nodeOrigin`** | Provenance: `'github'`, `'text-parser'`, etc. |
| **`created_at`** | Canonical ISO 8601 creation timestamp (optional); child-sort tie-break |
| **`weight`** | Optional effort weight for weighted completeness (default **1**) |

---

## 4. Solution System Design

This section captures the concrete system design decisions reached so far.
Anything still undecided is recorded in [Knowledge Gaps](#5-knowledge-gaps).

### 4.1 Guiding architectural principles

- **One shell around a shared core.** The product is a **framework-agnostic
  core** (domain model + validation + graph/NCN/TOC algorithms) with the UI as
  *a* shell on top of it — not the only possible product. This preserves maximum
  future optionality (e.g. a future standalone web viewer reusing the same core).
- **Data lives where the work lives.** The picture is **derived from the team's
  real tickets/backlog** via pluggable adapters, not from a separate hand-kept
  dataset.
- **Ticket-centric state; workspace-only configuration.** Anything the team
  should share/version (status, dependency links, vertical priority, narrative)
  should live **in tickets** as much as possible. Only "how this workspace is
  wired to its data" lives in local configuration.
- **Standard and proper.** The first shell is **Verto for VS Code** — a VS Code
  extension built with standard, idiomatic extension patterns — **no reliance on
  canvas infrastructure or any non-standard VS Code/Cursor mechanism.** (It should
  run in both VS Code and Cursor, which is VS Code-compatible.)

### 4.2 High-level architecture

```
+--------------------------------------------------------------------+
|              Verto for VS Code / Cursor (extension)                |
|                                                                    |
|  +----------------------------+      +--------------------------+  |
|  |  Extension Host (Node)     |      |   Webview (React UI)     |  |
|  |                            |      |                          |  |
|  |  - Adapter registry        | <==> |  - Delivery map lens     |  |
|  |  - Active adapter (GH/...) | post |  - NCN graph lens        |  |
|  |  - verto.config.jsonc merge | msg  |  - Priorities + order    |  |
|  |  - @verto/text-parser     |      |                          |  |
|  |    (materialize / filter)  |      |  - (dumb view of bundle) |  |
|  |  - Enable Parsed Reqs toggle|     +--------------------------+  |
|  |  - Workspace/global state  |                                    |
|  |  - Auth (e.g. GH provider) |                                    |
|  +-------------+--------------+                                    |
|                |                                                   |
+----------------|---------------------------------------------------+
                 |
        +--------+---------+----------------+
        |                  |                |
   GitHub Issues      fissue          Jira (later)
   (first adapter)    (local files)
                                                |
                       (shared, reused by all shells)
                +---------------------------------------+
                |   @verto/text-parser (enrichment)    |
                |   - RAW_REQ parse + materialize       |
                |   - filter when toggle off            |
                +------------------+--------------------+
                                   |
                +---------------------------------------+
                |        @verto/core (library)          |
                |   - Canonical domain types/schema     |
                |   - Validation (dangling deps, etc.)  |
                |   - closure / readiness / leverage    |
                |   - priority ranking + impl order     |
                |   - DAG layout                        |
                +---------------------------------------+
```

### 4.3 The shared core (`@verto/core`)

Host- and vendor-agnostic. Responsibilities:

- **Canonical domain model** (the schema below) and its TypeScript types.
- **Validation:** dangling dependency references, cycles, invalid vertical
  designations, missing required canonical fields, etc.
- **Pure algorithms** that depend only on the canonical model: `closureFor` (any node), `isReady`,
  leverage score, delivery completeness, **global priority ranking** (chain-traversal
  algorithm — see §3.5), and the priority-weighted topological **implementation order**.
  DAG **rendering layout** (node positions) lives in the extension webview
  (`@xyflow/react` + ELK), not in `@verto/core`.
- **No I/O, no host APIs, no UI.** Everything network/disk/host lives behind the
  adapter interface and the extension host.

### 4.4 Canonical domain model (Phase 2.5 schema)

> The canonical schema is defined in [`packages/core/src/types.ts`](./packages/core/src/types.ts) — that file is the authoritative field-level definition and will become `@verto/core/src/types.ts`.
>
> **Canonical schema (Phase 2.5).** `VertoNode` exposes the fields that `@verto/core`
> algorithms and the UI require. Phase 2.5 promotes from ticket passthrough to canonical
> root: `status`, `nodeType`, `nodeOrigin`, `personas`, `created_at`, `weight`,
> `_rawReqIds`, `_note`, `_outcome` (see
> [`packages/core/src/types.ts`](./packages/core/src/types.ts)). Core algorithm fields
> remain: `id`, `title`, `isDone`, `isDeliverySlice`, `priority`, `prereqIds`,
> `childIds`, `ticketUrl` (**required**). All other ticket fields stay in `node.ticketFields` via
> `fieldMappings` — see §4.6.4. Fields are promoted to canonical only when an algorithm
> or core UI feature genuinely needs them.

**Relationships at a glance:**

- **All tickets are graph nodes** with the same structure and graph behaviour.
  A **vertical** (vertical delivery / vertical slice / user journey / epic) is a
  **semantic designation** on a node, not a different entity type.
- A **delivery subgraph** rooted at any node N is N plus all transitive
  dependencies — the work required to deliver N.
- A **child ticket** is a dependency of its parent (child blocks parent) — the
  same graph semantics as a BlockedBy link.
- **Any ticket** may have children. All dependency links — parent/child or
  BlockedBy/Blocking — feed readiness, closure, leverage, and ordering
  identically.
- **Raw requirement lines** (`RAW_REQ:BEGIN` / `RAW_REQ:END`) are materialized as
  **`nodeType: 'parsed'`** graph nodes by `@verto/text-parser` when the global
  **Enable Parsed Requirements** toggle is on (default). They participate in NCN math
  like any other node. See §3.6–§3.8.
- **Child tickets** decompose a parent into implementable work. Parent/child and
  BlockedBy/Blocking both express necessary-condition edges (child blocks parent).
- **Delivery Map** (see §3.7) shows the **union** of child tickets and raw requirement
  lines in a **single pipeline column** per delivery-slice node.
- **Priority** is a required field on **all nodes** (default 5), from which the
  global priority ranking and implementation order are derived — see §3.5.

### 4.5 Tickets in the tracker

How tracker tickets map onto the graph:

- **Every ticket = one graph node** (`nodeType: 'ticket'`), with uniform structure
  and behaviour.
- **Vertical** (vertical delivery / vertical slice / user journey / epic) =
  the **same concept**, materialised as a top node (probably Epic ticket type).
  Slice header (Phase 3 UI): displays **`personas: string[]`** read from the slice node
  + `node._outcome` (first paragraph of `DESC:BEGIN` / `DESC:END`, pre-computed — §4.6.8). `personas` is populated
  per-issue at map time on any ticket that has matching labels (GitHub default:
  `persona:<value>`; see §4.6.7) — not restricted to slice nodes at load time.
- **Raw requirements** — checklist items between `RAW_REQ:BEGIN` / `RAW_REQ:END` —
  are materialized as **`nodeType: 'parsed'`** nodes by `@verto/text-parser` (Phase
  2.5). When **Enable Parsed Requirements** is on, they participate in NCN math and
  appear in the Delivery Map pipeline after child tickets. **No linking** to child
  tickets — concatenation only.
- **Child tickets** decompose a parent into implementable work. Parent/child and
  BlockedBy/Blocking both express necessary-condition edges (child blocks parent).
  Any ticket may have children, not only epics.
- **Parsed requirements on child tickets** affect that child's graph only — they do
  not roll up to the parent slice pipeline.

### 4.6 Multi-adapter support

Verto loads delivery state from external trackers through **pluggable adapters**.
Each adapter translates a vendor's native issue layout into the canonical
`VertoGraph` consumed by `@verto/core`. Adapters are **not** a second source of
truth — tickets in the tracker remain authoritative (see §4.9).

- **Adapter interface (conceptual):** `checkFields(config) → MissingField[]` (the
  load-time field check, §4.6.4) and `loadProject(config) → VertoGraph` — ticket
  nodes and edges only; no parsed-requirement enrichment, no bundle computation.
  The **host load pipeline** (§4.6.8) calls `@verto/text-parser`, validates, and
  runs `buildDeliveryMapBundle()`.
- **Adapters:** GitHub Issues (first, §4.6.7); **fissue**, a local file-based
  tracker (second, §4.6.10); Jira later. All implement the same interface and are
  selected/configured at workspace setup (see §4.6.3–§4.6.6, §4.6.9).

The subsections below document the **adapter architecture** agreed for
implementation.

#### 4.6.1 Canonical vs tracker-native models

Two distinct type layers — do not conflate them:

| Layer | Location | Role |
|---|---|---|
| **Canonical** | [`packages/core/src/types.ts`](./packages/core/src/types.ts) (`VertoNode`, `VertoEdge`, `VertoGraph`, …) | What `@verto/core` algorithms consume. Vendor-agnostic. **Authoritative Verto schema.** |
| **Tracker-native** | Per-adapter `system_types.ts` (e.g. `packages/adapters/github/system_types.ts`) | Typed shapes matching **that tracker's** issue layout after a read (e.g. GitHub `Issue`, ProjectV2 field values, issue type, labels, sub-issues, blocked-by). |

**Persistence:** tracker-native types describe an **in-memory (or short-lived cache)
representation during `loadProject`** — not a parallel backlog database. For the
file-based fissue adapter the tracker's own ticket files are the source store
(see §4.9, §4.6.10).

**Raw metadata:** adapters may attach tracker-native payload (or a slim subset) alongside
mapped nodes for write-back, debugging, and "open in tracker" links without
re-fetching.

#### 4.6.2 Adapter package layout

Each adapter lives under `packages/adapters/<vendor>/` with a consistent internal
split between **fixed vendor semantics**, **config-driven project fields**, **I/O**,
**mapping**, and **orchestration**:

```
.vscode/
  verto.config.jsonc          # workspace-specific adapter + mapping config (see §4.6.3)

packages/adapters/github/
  defaults.verto.config.jsonc # shipped defaults for this adapter (see §4.6.3)
  system_types.ts            # vendor-native shapes (Issue, ProjectV2 field values, …)
  project_fields.ts          # config-driven field registry (see §4.6.4)
  client.ts                  # GraphQL / REST I/O — queries & mutations
  mapper.ts                  # two-way mapping: tracker-native ↔ VertoNode / VertoEdge
  adapter.ts                 # VertoAdapter.loadProject() → VertoGraph only (§4.6.5)
  githubConfig.ts            # requireGitHubConfig() — guard when VertoConfig.github is optional

packages/text-parser/       # post-adapter enrichment — NOT a tracker adapter (§4.6.8)
  materialize.ts             # RAW_REQ → nodeType: 'parsed' nodes + edges
  filter.ts                  # strip parsed nodes when toggle off
```

Other adapters follow the same skeleton. File-system adapters may have a thinner
`project_fields.ts` (or none) when all fields are native to the format.

**GraphQL references** (agent prompts / schema extracts) live under
[`graphql/`](./graphql/) — e.g.
[`graphql/github_issues_graphql.agent_prompt.md`](./graphql/github_issues_graphql.agent_prompt.md).
These inform `client.ts`; they are not the adapter's TypeScript types.

#### 4.6.3 Configuration: defaults and workspace

Configuration is split into **adapter defaults** (versioned with the adapter) and
**workspace overrides** (versioned with the project):

| File | Location | Purpose |
|---|---|---|
| `defaults.verto.config.jsonc` | `packages/adapters/<vendor>/` | Sensible conventions: adapter id, conventional field names, default **fieldMappings** (including value maps, type hints), priority mapping tables, recommended ticket passthrough entries, etc. |
| `verto.config.jsonc` | `.vscode/` | Workspace-specific wiring: adapter selection, repo/project identifiers, project-specific **fieldMappings** (including optional overrides for system-mapped fields). **No secrets** — auth tokens live in editor/env settings, not in this file. |

**Effective config** is produced by merging defaults with workspace config; **workspace
wins on conflict**:

```
effectiveConfig = deepMerge(adapterDefaults, workspaceConfig)
```

**Merge granularity for `fieldMappings` (decided): field-level.** If the workspace
config defines a mapping entry for a Verto property (e.g. `status`), that entry
**replaces the entire corresponding entry from defaults** — including its `from`
binding and full `values` object. A partial workspace value map (e.g. only 5 of 10
Status options) does **not** deep-merge with the defaults' `values`; it is the
complete mapping for that field. Top-level config keys outside `fieldMappings` follow
the same field-level replace semantics where applicable.

**Future option:** value-level merge within a single `fieldMappings` entry (workspace
`values` merged into defaults `values` by key) may be added later if needed; not
supported initially.

This override rule applies uniformly to:

- **System fields** (built-in tracker / ProjectV2 fields such as Status, Title,
  Assignees, Issue Type) — default semantics in `system_types.ts` and
  `defaults.verto.config.jsonc`; workspace `fieldMappings` override when present.
- **Project-custom fields** (e.g. GitHub ProjectV2 custom columns such as
  `resolution`, AI SDLC metadata) — default bindings in
  `defaults.verto.config.jsonc`; workspace overrides when the project differs.

**Before the VS Code extension exists:** scripts and adapter development use
`defaults.verto.config.jsonc` directly, optionally merged with a hand-written or
audit-generated `.vscode/verto.config.jsonc`.

**When the extension exists:** first-run setup is implemented by the **setup wizard**
(§4.6.9): QuickPick flow for adapter + issue source, **audit/bootstrap** (§4.6.6),
merged defaults written to `.vscode/verto.config.jsonc` with explanatory JSONC comments,
then opened in the editor — never starting from a blank config.

**`@verto/config` package.** The `VertoConfig` TypeScript type, JSON Schema (validated
via `ajv`), and runtime helpers live in `packages/config/` (`@verto/config`):
`validateVertoConfig(raw)` — throws on invalid config; `mergeConfigs(defaults, workspace)`
— workspace wins; the **adapter block** (the block named by `adapter`, e.g. `github`,
`fissue`) is merged per key and its `fieldMappings` per entry; `withoutMappings` and
`applyConfigPatch` treat every adapter block the same way (no list of block names);
`parseVertoConfig(jsonc)` / `readVertoConfigFile(path)` —
JSONC-aware parsing. Config files use **JSONC format** (`.jsonc` extension; `//` line
comments allowed). Plain `JSON.parse` and `import ... assert { type: 'json' }` both fail
on JSONC — always use `parseVertoConfig`. `@verto/core` intentionally does not depend on
`@verto/config`; the config type lives in `@verto/config` only.

**`VertoConfig.github` is adapter-conditional.** The TypeScript type declares
`github?: GitHubConfig`. JSON Schema requires only `adapter` at the root; when
`adapter === "github"`, the `github` block is required (`allOf` + `if`/`then` in
`schema.ts`). Non-GitHub adapters omit `github` entirely; the `fissue` block is
optional (§4.6.10). GitHub
adapter code calls `requireGitHubConfig(config)` (`packages/adapters/github/src/githubConfig.ts`)
for a clear error when the block is missing.

**`@verto/config/priority-hints` subpath.** Browser-safe helpers for priority dropdown
labels (`buildPriorityOptionHints`, `formatPriorityOptionLabel`, …) — exported separately
so the webview bundle does not pull in `node:fs` via the main `@verto/config` parse path.

**`ui.displayStatusGroups` (Phase 2.5).** UI-layer
config under the root **`ui`** key. Maps open nodes' workflow **`status`** values
(and parsed `raw` / `done`) to human-readable **display group labels** for the
portfolio table, legends, UsageBar, NCN colouring, and status pills. Canonical
completion is **`node.isDone`** (graph math + system **Done** display bucket) —
**not** configured here.

Resolved in the webview via `resolveDisplayStatusGroup()` in
`@verto/config/display-status-groups` (re-exported by the extension webview);
not part of `DeliveryMapBundle`.

#### System-reserved **Done** group

- **Always present**, always evaluated **first**, never listed in user config.
- **Match rule:** `row.isDone === true` only (no `statuses` predicate).
- **Display label:** `"Done"`.
- **Source of `isDone`:** adapter / `fieldMappings` (default GitHub: native
  `issue.closed`). To treat specific workflow statuses as done, add a standard
  `fieldMappings.isDone` entry — display and graph math stay aligned.
- **Config validation** rejects any user group whose `label` is `Done` or `done`
  (case-insensitive) with an error pointing at `fieldMappings` / `isDone`.

Generated JSONC includes a comment above `displayStatusGroups` explaining that
system **Done** is reserved (see `stringifyVertoConfig` / setup wizard output).

#### User-configured groups

**Shape** (user config only — no `Done` entry):

```jsonc
{
  "ui": {
  // System-reserved display group "Done" matches node.isDone (ticket open/close via fieldMappings).
  // It is always evaluated first and is not listed below.
    "displayStatusGroups": [
      { "label": "In Progress", "sources": { "ticket": { "statuses": ["Doing", "Review"] } } },
      { "label": "Raw", "sources": { "ticket": { "statuses": ["Draft"] }, "parsed": { "statuses": ["raw"] } } }
    ]
  }
}
```

- Each group has a **`label`** and **`sources`** keyed by node kind: **`ticket`**
  and/or **`parsed`**.
- Each source rule contains **`statuses` only** (non-empty string array). The
  `isDone` predicate is **not** allowed on display groups — open nodes are
  implied (`!row.isDone`) because **Done** short-circuits first.
- **Validation** (`validateUserDisplayStatusGroups`, run from `parseVertoConfig`):
  reject reserved **Done** label; reject reserved **`others`** label; reject duplicate labels; reject empty `statuses`;
  reject the same status string in more than one group **per source type**
  (`ticket` vs `parsed` overlaps are independent).
- **Merge behaviour:** `mergeConfigs` shallow-merges `ui`; workspace `ui: {}`
  preserves defaults' `displayStatusGroups`; an explicit workspace
  `ui.displayStatusGroups` array fully replaces the defaults array.

#### Implicit **`others`** bucket

- **Label:** `"others"` (lowercase; not a configured group).
- **Runtime assignment:** after **Done**, walk user `displayStatusGroups` in array
  order; first group whose `sources.<nodeType>.statuses` contains `row.status`
  wins. If no match (including `status: undefined` or a new board value) → **`others`**.
- **Column / legend visibility:** the **`others`** column and legend entry appear
  only when the current **status universe** has at least one status not **accounted
  for** by config (see below). Recomputed on every panel refresh (`Verto: Refresh`,
  config save, parsed toggle, etc.). Host sends `showOthersColumn: boolean` in the
  `'update'` message.

#### Status universe and sufficiency (accounted statuses)

On each load, build the **status universe**:

| Source type | Universe = union of |
|---|---|
| **ticket** | Project audit Status options (`fetchProjectStatusOptions` on project scope) **∪** distinct `node.status` on ticket nodes in the loaded graph |
| **parsed** | Distinct `node.status` on parsed nodes in the loaded graph (typically `raw` and/or `done`) |

A status is **accounted for** when it appears in:

| Source type | Accounted set = |
|---|---|
| **ticket** | Union of all `ticket.statuses` across user groups **∪** status strings mapped to `true` in `fieldMappings.isDone.values` (if present) |
| **parsed** | Union of all `parsed.statuses` across user groups **∪** `{ "done" }` (parsed completion is structural: checklist → `status: "done"`, `isDone: true`) |

`showOthersColumn` is `true` when either source type has a universe status outside
its accounted set. **Ticket and parsed sufficiency are independent** — either can
trigger the **`others`** column.

**Parsed `isDone`:** materialized by `@verto/text-parser` as
`status: checked ? 'done' : 'raw'` and `isDone: status === 'done'` (not
user field-mapped). Display **Done** for parsed rows follows `isDone`, same as tickets.

#### Group assignment (matching algorithm)

1. If `row.isDone` → system **Done** (stop).
2. Else walk user `displayStatusGroups` **in array order**; skip groups with no
   rule for `row.nodeType`. Assign the **first** group whose `statuses` list
   contains `row.status` (requires `row.status` defined).
3. Else → **`others`**.

Palette index: **Done** = 0; user group *n* = *n*+1; **`others`** = −1
(`theme.ts` / `resolveDisplayStatusGroupIndex`).

#### Status display rule (Phase 4)

`displayStatusGroup` is the display vocabulary everywhere — column headers,
legends, node colouring, pill tones, UsageBar segments. Per-node labels:
`"<group> (<node.status>)"` when `node.status` is present; `"<group>"` when absent.
No user-group match: `"others (<node.status>)"` or `"others"`.

**Tooltips** (legends, portfolio column headers, UsageBar mini-legend): host builds
`displayStatusGroupTooltips` on each refresh (`buildDisplayStatusGroupTooltips`):
- **Done** — default `issue.closed` criterion, or listed `fieldMappings.isDone`
  status values when configured.
- **User groups** — `Tickets: …` and/or `Parsed: …` status lists.
- **`others`** — unaccounted statuses in the current universe (when column shown).

#### Consumers

- **Portfolio table** — column headers and per-slice counts per display group.
- **UsageBar** — weighted segments per group (plus **`others`** when visible).
- **Gap callouts** — rows with `!isDone` (independent of display bucket).
- **NCN** — node colouring, status column, legend (Phase 4).
- **Gaps ≠ `others`:** a row can be a gap (not done) while displaying **In Progress**
  or **`others`** depending on `status`.

#### Presentation (no config fields)

Colouring is by **group index** in a fixed VS Code theme palette (`theme.ts`).
Config is purely semantic: `label` + `sources.statuses` only.

#### Audit / wizard seeding (§4.6.6, §4.6.9)

`buildProjectDisplayStatusGroups(statusOptions)` seeds **user groups only** (no
**Done**): first Status option → **Raw** (`ticket`); middle options → **In Progress**
(`ticket`); last option is omitted from user groups (typically satisfied via
`issue.closed` → **Done**). Always includes `parsed: { statuses: ["raw"] }` on
**Raw** when ticket statuses are seeded. JSONC writer emits the system **Done**
comment above the array.

#### 4.6.4 Field mapping and the `FieldAccessor` contract

All mapping configuration lives in a declarative **`fieldMappings`** object inside
`verto.config.jsonc` (and defaults). Each entry binds a **Verto canonical property**
to a **ticket field** and defines how **values** are translated — not just names.

**`fieldMappings` must support:**

- **Field binding** — which ticket field feeds which `VertoNode` property (e.g.
  ProjectV2 `Priority` → `priority`, issue `type` → `isDeliverySlice`).
- **Value mapping** — enum↔enum, string↔number, defaults, and explicit fallbacks
  (e.g. map a tracker priority label to Verto `1–9`; map issue `type` values to `true`/`false` for `isDeliverySlice`).

Example shape (illustrative — exact schema to be defined in `VertoConfig`; file is JSONC so `//` comments are valid):

```jsonc
{
  "adapter": "github",
  "github": {
    "scope": "project",          // "project" | "repository" — first-class config choice (§4.6.7)
    "ownerType": "user",         // "user" | "organization" — default "user"
    "owner": "manmilani",
    "projectNumber": 1,          // required when scope is "project"
    // "repository": "my-repo", // required when scope is "repository"
    // Repository scope only:
    // "issueFilter": { "states": ["OPEN"] },
    // "includeClosedAncestors": true,  // default true — upward parent closure (§4.6.7)
    "fieldMappings": {
      // --- Canonical VertoNode fields (routed to node root) ---
      //
      // isDone: system-mapped from native GitHub `closed` boolean — no entry needed by default.
      // Override example (derive from a status field instead):
      // "isDone": { "from": { "kind": "projectV2", "field": "Status" }, "values": { "Done": true, "Closed": true, "Todo": false, "In Progress": false } }
      //
      // isDeliverySlice: system-mapped — true for top-level tickets (parent is null).
      // Override to use issue type instead (list the false options too; unlisted values keep the system value):
      // "isDeliverySlice": { "from": { "kind": "issue", "field": "type" }, "values": { "Epic": true, "Task": false, "Bug": false } }
      "status": {
        "from": { "kind": "projectV2", "field": "Status" }
        // Canonical root (Phase 2.5) — no "type" hint; options discovered by audit
      },
      "priority": {
        "from": { "kind": "projectV2", "field": "Priority" },
        "values": { "Critical": 1, "High": 3, "Medium": 5, "Low": 7, "Deferred": 9 }
      },
      // --- Ticket fields (routed to node.ticketFields) ---
      "storyPoints": {
        "from": { "kind": "projectV2", "field": "Story Points" },
        "type": "number"
      }
      // "sprint": { "from": { "kind": "projectV2", "field": "Sprint" }, "type": "iteration" }
      // Org issue field (organization-owned repos; works in both scopes):
      // "effort": { "from": { "kind": "issueField", "field": "Effort" }, "type": "number" }
      // Relationship as a plain ticket field (never a graph edge):
      // "duplicateOf": { "from": { "kind": "issue", "field": "duplicateOf" } }
    }
  }
}
```

**Mapper routing.** The mapper determines the destination for each `fieldMappings` entry by checking `CANONICAL_VERTO_NODE_KEYS` (exported from `types.ts`):

- Key **in** `CANONICAL_VERTO_NODE_KEYS` → `node[key]` (canonical root, typed)
- Key **not in** `CANONICAL_VERTO_NODE_KEYS` → `node.ticketFields[key]` (passthrough bag, `unknown`)

No config annotation is needed — routing is automatic and transparent. To promote a field from `ticketFields` to canonical: add it to `VertoNode` and `CANONICAL_VERTO_NODE_KEYS`; the same `fieldMappings` entry then routes to the root without any config change.

**Parsed sub-field mappings.** When `from.field` contains a dot (e.g. `"labels.persona"`, `"body.PHASE"`), the entry addresses a structured value *within* a tracker field rather than the field itself. The part before the dot is the **base field**; the part after is the **key to extract**. Dot-notation works for every `kind`.

Two hints on `FieldMappingEntry` describe the **source** (not the destination):

- **`type`** — coercion target for the extracted raw string. Defaults to `'text'` when absent. `'select'`/`'iteration'` are silently treated as `'text'` (projectV2-column-specific concepts not applicable here). `'boolean'`: for labels, boolean synthesis applies (see below); for text-block, standard coercion of the extracted string. `isArray: true` + `type: 'boolean'` is rejected at config validation.
- **`isArray`** — whether the output must be an array. Defaults to `false` when absent.

These two hints bring parsed fields to the same level of informedness as standard fields (where type and shape are known from tracker schema or audit).

- **Adapters** skip dot-notation entries in their main field-mapping loop and instead auto-include the base field in `node.ticketFields` (if not already explicitly mapped), so the text-parser has the raw value to parse. This applies to every `kind`; named custom fields (`'issueField'`, `'projectV2'`) are resolved by case-insensitive name match (GitHub: from `issueFieldValues` and `projectItem.fieldValues` respectively).
- **`@verto/text-parser`** receives `fieldMappings` via `HostPipelineOptions.fieldMappings` and runs `applyParsedFieldMappings` on every ticket node after `computeBodyFields`. It dispatches by the base field's runtime type:

| Base field runtime type | Parser | isArray: false | isArray: true |
|---|---|---|---|
| `string[]` | **Labels parser** | First `KEY:VALUE` raw string, or `null` on miss | `(string \| null)[]` — all matches in order; bare `KEY`-only → `null` slot; no matches → `[]` |
| `string` | **Text-block parser** | `KEY:BEGIN`/`KEY:END` block (plain or `<!-- -->`) → trimmed string, or `null` | `[string]` (one-element array) or `null` if block absent/empty |
| other | — | Entry skipped | Entry skipped |

Data flow per entry: `parser → [boolean synthesis] → values remapping → coerceFieldValue → routeParsedValue`

- **Parsers** are pure extractors — they never return booleans. For `isArray: false`, they return a raw string or `null`.
- **Boolean synthesis** (labels only, `isArray: false`): if the parser returns `null` and `type === 'boolean'`, the main loop checks `labels.includes(parsedKey)` → `true`/`false`. Values and `coerceFieldValue` are skipped for this synthesized boolean. Text-block misses with `type: 'boolean'` stay `null` (not written).
- **`values` remapping and coercion** are the shared mapping tail below (`applyMappingTail`). For `isArray: true`, `null` slots (bare KEY-only labels) pass through unchanged.
- **Routing** follows the standard rule (canonical root or `ticketFields`). `null` is never written; `[]` (empty array) and `false` (absent boolean label) are written. There is no special boolean-canonical skip — store what you get.
- **`select`/`iteration` on dot-notation** entries: resolved to `'text'` before coercion (these are projectV2-column-specific concepts).

**System-only canonical fields.** Not all `CANONICAL_VERTO_NODE_KEYS` members appear
in `fieldMappings`. These are **always** populated outside `fieldMappings` and are
**never** config entries:

| Field | Stamped by |
|---|---|
| `id`, `title`, `prereqIds`, `childIds`, `ticketUrl`, `created_at` | System accessor (tracker identity + dependency structure + creation time; GitHub: `createdAt`) |
| `nodeType`, `nodeOrigin` | **`mapper.ts`** on every adapter-produced node (`'ticket'` + adapter id, e.g. `'github'`) |
| `_rawReqIds` | **`@verto/text-parser`** (`[]` on ticket nodes before materialize; populated after) |
| `_note` | **`@verto/text-parser`** — `computeBodyFields` (ticket: first DESC paragraph); `materializeParsedRequirements` (parsed: note from RAW_REQ line) |
| `_outcome` | **`@verto/text-parser`** — `computeBodyFields` (ticket: first DESC paragraph; same as `_note`); always `undefined` on parsed nodes |
| `personas` (GitHub default) | **`@verto/text-parser`** `applyParsedFieldMappings` via `fieldMappings.personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true }` (default config); **`mapper.ts`** label-extraction fallback when no `fieldMappings.personas` entry exists |
| `weight` | **`fieldMappings`** when an effort estimate exists (optional; normalized by `nodeWeight()` — see `completeness.ts`) |

`isDone` and `isDeliverySlice` are populated by the system accessor by default but
may be overridden via an optional `fieldMappings` entry. `priority` and `status`
require user-configured `fieldMappings` bindings when the tracker exposes those
fields (`status` may be absent — see §4.6.5). **`personas`:** the GitHub adapter
default config includes `personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true }`;
`@verto/text-parser` extracts persona values from `ticketFields.labels` and writes them
to `node.personas`. When no `fieldMappings.personas` entry is present, `mapper.ts`
falls back to direct `persona:<value>` label extraction. If neither applies, **`[]`**.

**Mapping tail — one rule for every adapter and the text-parser.** After an entry's
source value is read (and flattened, e.g. a ProjectV2 iteration to its `title`),
`applyMappingTail(value, values, type)` (`@verto/config`) runs per list item (or on the
scalar): `values` is applied (a value missing from `values` → `null`), then
`coerceFieldValue(type)`; `null` items stay `null`. Then:

- a `null` result for a **canonical** key (e.g. `isDone`) keeps the system value — so a
  partial `values` map overrides only the values it lists; an override meant to decide
  every ticket lists its `false` options too;
- **priority:** unmapped → 5, silently; mapped but empty or invalid → 5, logged once per
  load with a count.

**`type` hint for ticket fields.** Non-canonical `fieldMappings` entries may carry an optional `"type"` hint (`"text"`, `"number"`, `"date"`, `"select"`, `"iteration"`). The mapper uses it to coerce raw source values to the correct JavaScript type. The hint is omitted for canonical fields (their types are in `types.ts`). The audit step populates it automatically from the source's field schema (§4.6.6).

**Names only in user-facing config.** All field bindings, option names, issue type
names, and repo/project identifiers in config files use **human-readable names**.
**Node IDs** (GitHub field IDs, single-select option IDs, etc.) are **never**
authored by users. ID resolution is a **runtime behaviour** for performance: the
adapter may cache resolved IDs in memory (or optionally persist a cache inside
workspace config), but must **always fall back to name-based lookup** if a cached
ID is missing or stale.

**`FieldAccessor` — adapter-internal mapping contract.** System fields and
project-custom fields both implement a shared accessor interface so `mapper.ts` can
compose them uniformly:

```ts
// Conceptual — exact signatures live in the adapter package
interface FieldAccessor {
  readonly kind: 'system' | 'project';
  getDefinitions(): FieldDefinition[];
  readFromIssue(raw: unknown): Record<string, unknown>;
  toVertoNodeFields(values: Record<string, unknown>): Partial<VertoNode>;
}
// Write-back works per change, not per node: §4.6.11.
```

- **System accessors** — backed by typed `system_types` and fixed mapping rules for
  fields the adapter always handles (e.g. `id`, `title`, dependency links, issue type).
  Populate all system-mapped canonical fields: `prereqIds` and `childIds` from
  blocking/sub-issue relationships; `isDone` from the tracker's native done/closed
  field; `isDeliverySlice` from parent presence; `ticketUrl` from native issue URL.
  **`mapper.ts` stamps `nodeType: 'ticket'` and `nodeOrigin: '<adapter-id>'`** (e.g.
  `'github'`) on every ticket node after accessors run — not via `fieldMappings`.
  **GitHub `personas` fallback:** when `fieldMappings.personas` is entirely absent,
  `mapper.ts` collects `<value>` from each issue label whose name starts with `persona:`
  (prefix match, case-sensitive); preserve label list order; dedupe not required. When
  `fieldMappings.personas` IS present (default config uses `"labels.persona"`), the
  adapter sets `personas: []` as a placeholder and `@verto/text-parser` fills it via
  `applyParsedFieldMappings`. A `fieldMappings` entry for `isDone` or `isDeliverySlice`
  overrides the system-accessor default for that field.
- **Project accessors** — backed by `project_fields.ts`, a **config-driven field
  registry** that reads `fieldMappings` from effective config and exposes the same
  `FieldAccessor` interface for all remaining fields — both canonical ones that need
  canonical fields that require or optionally override system-accessor defaults
  (e.g. `priority` — always required; `isDone`, `isDeliverySlice` — optional
  overrides) and non-canonical ticket fields that land in `node.ticketFields`.

**`kind` disambiguation.** `FieldAccessor.kind` (`'system' | 'project'`) describes
which accessor *manages* a field. `from.kind` in `fieldMappings` config
(`'issue' | 'issueField' | 'projectV2'`) describes *where in the tracker* a field lives. The two
`kind` values are in separate namespaces and do not conflict.

**Source kinds (`from.kind`).** `from.kind` names *where* in the tracker a field
lives; `from.field` is its name there, matched the way the tracker matches names
(GitHub custom fields: case-insensitive; fissue: exact frontmatter keys). Kinds use
GitHub's vocabulary; other adapters reuse the kinds that apply to them:

| `from.kind` | Source | GitHub | fissue (§4.6.10) |
|---|---|---|---|
| `issue` | Built-in properties of the ticket | Properties of the GraphQL `Issue` type (`closed`, `labels`, `issueType`, `duplicateOf`, …) | Native fields (GitHub `Issue` names where they exist) |
| `issueField` | Typed custom fields available on every ticket, without a project | Org-level **issue fields** (`Issue.issueFieldValues`) | Fields with `kind: "issueField"` in `.fissue/config.json` |
| `projectV2` | Project board fields | ProjectV2 fields, built-in and custom | — |

**Trust the config.** Adapters do not restrict `from.field` to a hard-coded list: any
name the config gives for a kind is assumed to exist and is tried. Tables of known
fields (e.g. GitHub's `ISSUE_FIELD_RESOLVER`) only flatten known nested values (e.g.
`labels.nodes[].name` → `string[]`); they are not allow-lists. A new scalar tracker
field is therefore mappable without code changes; an object or list property needs a
flattening entry (until then it is reported as unsupported, below).

**Load-time field check.** Every adapter checks all mapped fields of every kind
**once per load**, before reading tickets (not per ticket), via
`checkFields(config) → MissingField[]`, where `MissingField` =
`{ key, field, kind, scope, reason, suggestedKinds }` (mapping key, configured field
name, kind, the scope searched, `'missing' | 'unsupported'`, and other kinds where the
same name exists).
`loadProject` then runs without any entries the user chose to skip.

- **Dot-notation entries** (e.g. `labels.persona`) are checked by their base field
  (the part before the dot).
- **Missing vs empty.** A field that exists but has no value on a ticket → `null`, no
  warning. A field that doesn't exist in its kind's scope → a `MissingField`. Never a
  silent `null`.
- **Suggestions.** A name missing in its configured kind is looked up in the
  tracker's other kinds, e.g. *`fieldMappings["priority"]`: "Priority" is not a
  property of Issue (kind "issue"). Found it as an org issue field — did you mean kind
  "issueField"?*
- **User choice.** If anything is missing, the extension host shows **one** warning
  listing every missing field with its suggestions and offers **Skip and load** (drop
  those entries from the effective config; §4.6.5 fallbacks apply) or **Cancel** (no
  graph). A skip is remembered for the session until the config changes, so refreshes
  don't repeat the prompt. Non-interactive scripts print the warning and skip.
- **Unsupported fields** — names that exist but can't be read as a plain value (e.g.
  an object property with no flattening entry) — are listed in the same warning and
  handled the same way.
- **Where it runs.** The host pipeline does check and skip once, for every adapter:
  `adapter.checkFields?(config)`, then `withoutMappings(config, keys)` (`@verto/config`);
  `loadProject`, `fieldMappings`, sufficiency and parsed mappings all use that reduced
  config.
- **Failed lookups.** A kind whose lookup fails (network, token scope, an error not
  attributable to a mapping) is not checked: its mappings are trusted and it gives no
  suggestions. If that kind is mapped, the user sees one non-modal warning naming the
  kind and the error; the load continues.
- **Built today.** The extension shows the modal Skip / Cancel prompt with session
  memory (keyed by config and warning text; survives closing the panel); scripts print
  the list and skip. fissue checks by name (§4.6.10); GitHub checks all three kinds with
  suggestions (§4.6.7).

**Relationship fields.** Only parent/child and blocked-by/blocking become graph edges
(system accessor, §4.6.5). Any other relationship (e.g. GitHub `duplicateOf`,
`relatesTo`) can be mapped like any other `kind: "issue"` field: values are flattened
to ticket IDs — the same IDs as `VertoNode.id` (a single ID or `string[]`) — and land in `node.ticketFields`; they never
change `prereqIds` / `childIds`.

**`FieldAccessor` does not limit GraphQL.** It standardises how tracker data is
**projected onto `VertoNode`** for the read/write mapping path. `client.ts` retains
full GraphQL (or REST) capability — arbitrary queries, mutations, pagination,
batching, and future API features — for operations that do not map 1:1 to a single
Verto field.

**Status — system shape, project values.** The built-in ProjectV2 **Status** field
is a **system** field in shape (single-select on the project), but its **allowed
option set** is project-specific. Default value maps live in `system_types.ts` and
`defaults.verto.config.jsonc`; workspace `fieldMappings` override when the project's
Status options differ. The audit step (§4.6.6) detects the current Status options
and drafts the mapping section.

#### 4.6.5 Adapter internals: client, mapper, adapter

| Module | Responsibility |
|---|---|
| **`client.ts`** | All I/O with the data source: auth, pagination, rate limits, GraphQL/REST calls. Returns tracker-native shapes (`system_types`). Unrestricted by `FieldAccessor`. |
| **`mapper.ts`** | Two-way translation between tracker-native data and `VertoNode` / `VertoEdge`, composing system and project `FieldAccessor`s and applying `fieldMappings` (field + value). Applies **required-field fallback policy** (below). May delegate to accessors; split into sub-modules later if it grows. |
| **`adapter.ts`** | `checkFields(config)` — the load-time field check (§4.6.4). `loadProject(config)` orchestrates: load effective config → `client` read → `mapper` → **`VertoGraph`** (ticket nodes only). Does **not** call `@verto/text-parser` or `buildDeliveryMapBundle()`. Optional write-back: `checkChange(config, change)` and `writeBack(config, changes, hooks)` (§4.6.11). |

**Host load pipeline** (extension `loadPipeline.ts`, `scripts/load-project.mjs`) —
not inside adapters:

```
registry: adapter = ADAPTERS[config.adapter].create(env)   // env: workspace folder, GitHub token (lazy), fissue API
adapter.checkFields?(config) → MissingField[]   // §4.6.4; skip or cancel, config = withoutMappings(config, keys)
adapter.loadProject(config) → VertoGraph
adapter.projectTitle?(config) ?? config.adapter   // panel title
  → runHostPipeline(graph, { parsedEnabled?, changes?, fieldMappings? }) → { bundle, changeStates }
       → materializeParsedRequirements(graph)
       → computeBodyFields(graph)
       → applyParsedFieldMappings(graph, fieldMappings)
       → applyChanges(graph, draft)        // §4.6.11; longest valid prefix if the draft breaks validation
       → filterParsedNodes(graph)          // when !parsedEnabled / --no-parsed
       → validateGraph(graph)
       → buildDeliveryMapBundle(graph)
```

`loadPipeline.ts` splits this into `loadProjectGraph` (check, skip, load: the kept load)
and `buildView(load, changes, parsedEnabled)` (pure; rebuilt on every edit);
`runPipeline` composes them without a draft for the load script.

**Adapter registry** (`packages/extension/src/host/adapterRegistry.ts`, no `vscode`):
one entry per adapter id, `{ defaults, create(env), setup? }`. `env` gives what an
adapter may need (workspace folder, `getGitHubToken`, `getFissueApi`); each is called
only by the adapter that uses it, so a GitHub token is requested only for GitHub.
`setup.isComplete` exists for adapters with a setup wizard (§4.6.9). The registry,
`workspaceConfig.ts` (read → validate → completeness → merge with the adapter's
defaults) and `loadPipeline.ts` are shared by the extension and the load script.

**Panel title:** optional `adapter.projectTitle(config)` (GitHub: project or repo
name; fissue: `fissue: <root folder>`), falling back to the adapter id.

**Required-field fallback policy (read path).** Some `VertoNode` properties are
required but may have no mapped ticket field. The mapper must behave consistently:

| Category | Verto properties | Behaviour when unmapped / invalid |
|---|---|---|
| **No fallback — fail** | `id`, `isDone`, `isDeliverySlice`, `ticketUrl`, `prereqIds`, `childIds`, `nodeType`, `nodeOrigin` | **Error; do not produce a graph.** System-mapped or stamped by `mapper.ts` (see system-only table above). If absent after mapping, data is corrupt. |
| **Fallback to `id`** | `title` | An empty or missing title is replaced by the node `id` (every adapter). |
| **Valid neutral default — continue** | `priority` | **Use `5`**, continue. Unmapped: silent (audit flags the missing mapping). Mapped but empty or invalid: one log line per load with a count. |
| **Optional — continue** | `status` | **`undefined`** if no `fieldMappings` binding, or the entry was skipped (a missing field the user skipped, §4.6.4; or `projectV2` in repository scope, §4.6.7). No error. |
| **Optional — continue** | `personas` | **`[]`** if no `persona:<value>` labels and no `fieldMappings.personas` entry. Default config uses `"labels.persona"` dot-notation; `@verto/text-parser` populates from labels. No error. |
| **Optional — continue** | `weight` | **`undefined`** if unmapped. Algorithms use `nodeWeight()` (see `completeness.ts`). No error. |
| **Optional — continue** | `created_at` | **System accessor** on GitHub (`issue.createdAt`); overridable via `fieldMappings.created_at`. No error if absent on other adapters. |
| **Enrichment-only** | `_rawReqIds` | **`[]`** on ticket nodes from adapter; populated by `materializeParsedRequirements`. Adapter does not set parsed-node entries. |

Parsed nodes (`nodeType: 'parsed'`) are created only by `@verto/text-parser`; they
are not subject to adapter fallback policy.

**Read path (adapter):**

```
Tracker → client.ts → tracker-native types → mapper.ts (+ FieldAccessors) → VertoGraph
```

**Read path (host — after adapter):**

```
VertoGraph → @verto/text-parser (materialize / filter) → validateGraph → buildDeliveryMapBundle → DeliveryMapBundle
```

**Write path (§4.6.11):**

```
panel edit → VertoChange in the draft → adapter.writeBack (reverse mapping → client writes) → Tracker → reload
```

#### 4.6.6 Project audit and config bootstrap

To avoid manual enumeration of project-specific fields, adapters support an
**audit/bootstrap** step that queries the live project (e.g. GitHub ProjectV2
fields, options, issue types) and produces a **draft** `.vscode/verto.config.jsonc`:

1. List all relevant ticket fields, types, and enum/option values (system + custom).
2. Pre-fill `fieldMappings` by merging **adapter defaults** with what was discovered
   (known recommended mappings such as `priority`, `status`, `stateReason` (GitHub passthrough), AI SDLC metadata fields).
3. Flag **gaps** — Verto concepts with no matching ticket field (e.g. `priority` if
   not on the board).
4. Emit a draft config using **names only**; ID caches are populated at runtime on
   first load.
5. Seed **`ui.displayStatusGroups`** (user groups only — no **Done**; see §4.6.3):
   `buildProjectDisplayStatusGroups` from Status column options.
6. Preserve **JSONC comments** on write (setup wizard and tooling use an AST-aware
   writer — not `JSON.stringify`).

**Interim tooling:** [`scripts/sync-github-project-fields.mjs`](./scripts/sync-github-project-fields.mjs)
prototypes aligning a GitHub ProjectV2 field *schema* with the VertoNode-derived
column set (Status options + custom fields). The extension's setup wizard (§4.6.9)
reuses audit discovery logic when seeding `verto.config.jsonc`.

#### 4.6.7 First adapter: GitHub Issues

Grounded in GitHub GraphQL capabilities documented under
[`graphql/`](./graphql/).

| Verto concept | GitHub home (decided) |
|---|---|
| **NCN edge** `A → B` (A prerequisite for B) | `addBlockedBy(issueId: B, blockingIssueId: A)`; read via `blockedBy` / `blocking` |
| **Parent/child** (child blocks parent) | Sub-issue relationship (`addSubIssue`, `parent` / `subIssues`); same graph semantics as blocking |
| **Done** (`isDone`) | Native GitHub issue `closed: boolean` — populated by system accessor; no `fieldMappings` entry needed by default. Drives `isReady` and `implementationOrder`. Overridable via `fieldMappings` if needed. |
| **Vertical designation** (`isDeliverySlice`) | System accessor default: `true` for top-level tickets (`parent` is null). Override via standard `fieldMappings` entry — e.g. `{ "from": { "kind": "issue", "field": "type" }, "values": { "Epic": true, "Task": false, "Bug": false } }` (unlisted values keep the default) |
| **Status** (`status`) | ProjectV2 built-in `Status` field — **canonical root** via `fieldMappings` (optional; `undefined` if unmapped) |
| **State reason** (`ticketFields.stateReason`) | Recommended passthrough in `defaults.verto.config.jsonc` — native GitHub issue field (`completed` / `not_planned` / `duplicate` / `reopened` / null); useful for display and filtering; `"type": "text"` |
| **Issue type** (`ticketFields.type`) | Native **org-level GitHub Issue Type** (defaults: Task, Bug, Feature; org may add e.g. Epic). **Not** duplicated as a project custom column |
| **Raw requirements** | Issue body `RAW_REQ:BEGIN` / `RAW_REQ:END` block; materialized by `@verto/text-parser` |
| **Personas** (`personas`) | Default config: `personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true }` — dot-notation parsed sub-field; `@verto/text-parser` extracts `persona:<value>` labels → `string[]`. Workspace config may override. When no `personas` entry at all: `mapper.ts` label-extraction fallback. |
| **Labels** (`ticketFields.labels`) | Native issue labels — passthrough includes all labels; also the base field for `labels.persona` sub-field extraction |
| **AI SDLC metadata** (`ticketFields.*`) | ProjectV2 custom TEXT/NUMBER fields (`specified_by`, `planned_by`, …) — see recommended field names in `types.ts` `ticketFields` comment. Stored as comma-separated TEXT in GitHub — **values must not contain commas** (IDs, session IDs, model names are safe; arbitrary free text is not). Document this constraint at write time. |
| **Assignee, timestamps, body** (`ticketFields.*`) | Native issue / built-in ProjectV2 fields — non-canonical passthrough; `type` hints as appropriate |
| **Issue fields** (`ticketFields.*` or canonical, e.g. `priority`) | Org-level **issue fields** via `kind: "issueField"` — typed custom fields (text, number, date, single-select, multi-select) on every issue of every repo in the org, without a Project. Read from `Issue.issueFieldValues`; matched by case-insensitive name; `values` maps and `type` coercion apply as for `projectV2` (single-select → `select`; multi-select → `select` + `isArray`). |
| **Duplicate of / Relates to** (`ticketFields.*`) | Native `duplicateOf` (one issue or null) and `relatesTo` (list) via `kind: "issue"` — flattened to issue IDs; never graph edges (§4.6.4 relationship fields) |
| **Source URL** (`ticketUrl`) | Native issue `url` field — canonical root field; system-mapped (no `fieldMappings` entry needed) |
| **Priority** (`priority`) | Mapped via `fieldMappings` with `values` map when a source priority field exists. **If unmapped:** mapper uses **`5`** (neutral default) and continues; audit flags the gap. See required-field fallback policy (§4.6.5). |

**`github.scope` — project vs. repository (Phase 2 decision).** The GitHub adapter
supports two mutually exclusive modes, controlled by `github.scope` in `verto.config.jsonc`:

| `github.scope` | Issue enumeration | Board fields (`Status`, custom columns) |
|---|---|---|
| `"project"` | ProjectV2 API: `user\|organization(login).projectV2(number).items` | ProjectV2 API: per-item field values |
| `"repository"` | Issues API: `repository(owner, name).issues` with optional `issueFilter` | Not available — `kind: 'projectV2'` entries skipped with a console warning (a scope choice, not a missing field; not part of the field-check prompt) |

`kind: "issue"` and `kind: "issueField"` work in both scopes. Issue fields exist only
for organization-owned repositories; on a user-owned repo every `issueField` mapping
is reported missing ("issue fields require an organization").

**Issues-first API principle.** Regardless of scope, all issue-native fields (`id`,
`title`, `body`, `closed`, `url`, `stateReason`, issue type, labels, assignees, milestone,
`parent`, `subIssues`, `blockedBy`, `blocking`, `duplicateOf`, `relatesTo`,
`issueFieldValues`, and any other configured `Issue` property) are read via the
**Issues GraphQL API**.
The ProjectV2 API is used only to (a) enumerate which issues belong to the project and
(b) read ProjectV2 board field values. This minimises ProjectV2 usage and keeps the
mapping layer consistent across scopes.

**Field check per kind (GitHub).** `checkFields` (§4.6.4) runs one pass per load:

| `from.kind` | How existence is checked |
|---|---|
| `issue` | A probe query `viewer { issues(first: 0) { nodes { … } } }` (validated, never executed) is sent with the `Issue` selection built from the configured fields (not a fixed list), every entry under a unique alias so each error is attributable to one mapping (via the alias in its `path`). GitHub rejects unknown properties as `errors[]` entries with `extensions.code: "undefinedField"`, `typeName` and `fieldName` (HTTP 200; all reported together, independent of data); these identify every missing field. Unknown names are selected as scalars; a name GitHub rejects as needing a sub-selection or arguments (an object or connection with no resolver entry) is reported as unsupported. `loadProject` builds its selection the same way, minus skipped entries. Names known to `ISSUE_FIELD_RESOLVER`, including its aliases (e.g. `type` → `issueType.name`, `assignee` → first of `assignees`, `updated_at` → `updatedAt`), count as existing. |
| `issueField` | The issue-field definitions of the configured `github.owner` are fetched via `repositoryOwner(login)` (both scopes; works for users and orgs) and compared case-insensitively; if the owner is a user, every `issueField` mapping is missing. Needed because an unknown name never fails a query — it just never appears in `issueFieldValues` — so only the definitions tell "doesn't exist" from "empty". |
| `projectV2` | Compared case-insensitively against the project's field definitions (already fetched for Status options). Project scope only. |

The three lookups run in parallel and are best-effort: a failed lookup leaves its kind
unchecked (§4.6.4 "Failed lookups"). Suggestions come from the same three lookups. In project scope an org issue field
added to the Project can be read through either `projectV2` or `issueField`; the kind
in config decides.

**`github.ownerType`.** Set to `"user"` (default) or `"organization"` to select between
`user(login).projectV2` and `organization(login).projectV2` for project-scope enumeration.

**Repository scope: issue filter.** `github.issueFilter` (labels, states, milestone,
assignee) narrows which issues Verto **reads** from the repository — it does not
configure GitHub. Without narrowing, `repository.issues` with default
`states: ["OPEN"]` returns every open issue — unworkable for large repos. The setup
wizard and audit seed a default `issueFilter: { "states": ["OPEN"] }` and comment
optional label/milestone narrowing discovered from the repo.

**Repository scope: closed ancestors (`github.includeClosedAncestors`).** GitHub's
Issues API cannot express "include closed issues that have an open parent or open
descendant." Hierarchy inclusion is **adapter load policy**, not `issueFilter` syntax.
When `includeClosedAncestors` is **`true`** (default), after the initial fetch and
`expandGraphClosure()` (blocking / sub-issues), the adapter walks **upward** along
`parent` links: for any loaded issue whose parent is not yet in the graph, fetch the
parent recursively to the root. Set to `false` to skip upward closure (open issues
only, plus downward/cross refs from `expandGraphClosure`).

**Graph closure for cross-scope references.** Blocking links (`blockedBy`), sub-issues
(`subIssues`), and external dependents (`blocking`) can reference issues outside the
configured project or filter set. After the initial fetch the adapter runs
`expandGraphClosure()` — a BFS fixed-point loop that collects all referenced issue node
IDs not yet in the graph, fetches them in batches (via the Issues API), and repeats until
closure is complete (capped at 5 rounds with a summary warning). Issues fetched during
closure have no ProjectV2 field values; `priority` defaults to `5` for them. If the cap is
reached with refs still unresolved, `validateGraph()` will surface the dangling refs as
errors. Downward `expandGraphClosure` still does **not** follow `parent.id` (child's
`prereqIds` does not include its parent); upward parent closure (above) covers closed
ancestors of loaded open issues. An unloaded parent alone causes no dangling reference
under Verto semantics.

**Cross-link:** See [Phase 2 implementation plan](./IMPLEMENTATION.md#phase-2--github-adapter-read-only)
for the full deliverables, decisions, and verification steps.

**GitHub issue types (reference):** every org ships with **Task**, **Bug**, and
**Feature**; org owners may create up to **25** types total (rename/disable/delete
defaults allowed). Types are org-scoped and shared across repos.

**GitHub issue fields (reference):** up to **25** per org; types text, number, date,
single-select, multi-select; every org starts with **Priority**, **Effort**, **Start
date** and **Target date**. They can be set on any issue regardless of issue type;
"pinning" a field to an issue type only controls whether the UI shows it. Personal
(user-owned) repos have none. A workflow Status is not built in; orgs may model it as
a single-select issue field.

**Excluded from project field sync** (graph / adapter identity, not board columns):
`id`, `prereqIds`, `childIds`; `isDone` (from native `closed` boolean — no board
column); `isDeliverySlice` (from parent presence by default — no board column unless
overriding via fieldMappings to use issue type).
**`priority`** is optional on the board — when absent, mapper defaults to `5` (§4.6.5).
**`ticketUrl`** is populated from the native issue `url`; no board column needed.

**Recommended in `defaults.verto.config.jsonc`.** Fields that are now non-canonical
ticket passthroughs — particularly `labels`, `assignee`, `body`, `type`,
`created_at`, `updated_at`, and AI SDLC metadata — should be pre-configured in the
adapter defaults file so teams get them out of the box without manual enumeration.
Noisy or rarely-needed entries (e.g. AI SDLC fields) may be commented out by default
but should be present and auditable. The extension's audit step (§4.6.6) populates
these from the live project schema.

#### 4.6.8 Parsed requirements (`@verto/text-parser`)

**Not a tracker adapter.** `@verto/text-parser` runs in the **host load pipeline**
(§4.6.5) on a `VertoGraph` returned by `adapter.loadProject()` — never inside adapters.

**Exports:**

1. **`materializeParsedRequirements(graph)`** — for every `nodeType: 'ticket'` node
   whose `ticketFields.body` contains `RAW_REQ:BEGIN` / `RAW_REQ:END`, parse
   checklist lines and append `nodeType: 'parsed'` nodes plus `parsed-req` edges to
   the parent. Populate `_rawReqIds[]` on parents; set `_note` on each parsed node
   from the RAW_REQ line text. Recompute each affected parent's
   `prereqIds` = `_rawReqIds ∪ childIds ∪ blockingPrereqIds` (deduped), where
   `blockingPrereqIds` = `{ edge.from | edge.to === node.id && edge.reason === 'blocking' }`
   (parent-child deps are in `childIds`, not duplicated).
2. **`computeBodyFields(graph)`** — for every `nodeType: 'ticket'` node, parse
   `ticketFields.body` and extract the **first paragraph** of the `DESC:BEGIN` /
   `DESC:END` block (split on `\n\s*\n`, take index 0; strip HTML comments). Sets
   `_note` and `_outcome` on the node root. Both fields receive the same value (the
   first DESC paragraph). Run **after** `materializeParsedRequirements` in the pipeline.
3. **`filterParsedNodes(graph)`** — remove all `nodeType: 'parsed'` nodes and edges
   with `reason: 'parsed-req'`; clear `_rawReqIds` on parents; recompute `prereqIds`
   without parsed ids. Used when **Enable Parsed Requirements** is off.
4. **`parseDescBlock(body)`** — low-level helper: extract the first paragraph of the
   `DESC:BEGIN` / `DESC:END` block (strip HTML comments, split on blank line, take
   first paragraph). Called by `computeBodyFields`; not for direct use in the webview.
5. **`runHostPipeline(graph, opts?)`** — `opts.parsedEnabled` (default `true`),
   `opts.changes` (the write-back draft, §4.6.11), `opts.fieldMappings`:
   `materializeParsedRequirements` → `computeBodyFields` → `applyParsedFieldMappings` →
   `applyChanges` (after parsed mappings, so a drafted `personas` isn't overwritten by
   labels) → `filterParsedNodes` when `parsedEnabled` is `false` → `validateGraph` →
   `buildDeliveryMapBundle`; returns `{ bundle, changeStates }`. If the draft breaks
   validation, the longest valid prefix is used and the rest are `invalid` (with the
   validation message); a graph that is invalid without the draft throws. Pure: the
   input graph is not changed. Shared by `scripts/load-project.mjs` and extension
   `loadPipeline.ts`.

**Body stripping (`panelManager.ts`):** Before sending the `'update'` message,
`panelManager.ts` sends a copy of each node without `ticketFields.body` (the kept load,
rebuilt on every edit, keeps its bodies). `_note` and `_outcome` are already on the node
root; the raw body is not needed by the webview and is stripped to reduce payload size.

**Orchestration** — single owner: **`runHostPipeline`** in `@verto/text-parser`
(§4.6.5). Adapters return **`VertoGraph` only**.

```
adapter.checkFields(config)  →  MissingField[] // §4.6.4; skip or cancel
adapter.loadProject(config)  →  VertoGraph   // ticket nodes; _rawReqIds: []
  → runHostPipeline(graph, { parsedEnabled })
       materializeParsedRequirements   // parsed nodes + _rawReqIds
     → computeBodyFields               // _note + _outcome on ticket nodes
     → filterParsedNodes?              // only when parsedEnabled: false
     → validateGraph
     → buildDeliveryMapBundle
     → DeliveryMapBundle
  → panelManager strips ticketFields.body before webview 'update' message
```

**Global toggle:** **Enable Parsed Requirements** — default **on**; persisted in
`workspaceState`; applies to **all lenses**. Host rebuilds bundle on change. Always
materialize, then filter when off.

**`validateGraph` — `prereqIds` consistency (Phase 2.5).** For each node *after*
materialize (parsed toggle on path), assert:

```
expectedPrereqs = dedupe(
  node.childIds
  ∪ node._rawReqIds
  ∪ { edge.from | edge.to === node.id && edge.reason === 'blocking' }
)
```

Mismatch → validation error. After `filterParsedNodes`, same formula with
`_rawReqIds` empty.

Parsed nodes: `isDeliverySlice: false`, `priority: 5`, `nodeOrigin: 'text-parser'`,
`nodeType: 'parsed'`, `status` = `raw` or `done` from checkbox. Synthetic **id:**
`{parentId}#raw-req-{n}`; **ticketUrl:** parent `ticketUrl` + `#raw-req-{n}` (required).

**`VertoEdge.reason` (Phase 2.5):** closed union `'parent-child' | 'blocking' |
'parsed-req'` — remove open `| string` so `filterParsedNodes` is type-safe.

**`ticketUrl` (Phase 2.5 alignment):** required on all nodes (`ticketUrl: string`,
not optional). `validateGraph` emits an **error** (not warning) when absent on ticket
nodes. Parsed nodes inherit parent URL + anchor.

#### 4.6.9 First-run setup wizard

**Phase 4.5.** Guided workspace configuration from the VS Code extension — no
hand-written config required for first use. Implementation detail:
[IMPLEMENTATION.md Phase 4.5](./IMPLEMENTATION.md#phase-45--setup-wizard--config-bootstrap).

**UI pattern.** QuickPick and input boxes; final step **opens** `.vscode/verto.config.jsonc`
in the editor. No dedicated setup webview for config editing.

**Entry points.**

| Trigger | Behaviour |
|---|---|
| First `verto.openPanel` | Start setup when config is missing, incomplete, or invalid |
| `verto.setup` command | Always available |
| **Setup** button in webview | Only for missing / incomplete / invalid config — not auth or API errors |
| Re-run on existing config | *"Config exists — re-run setup?"*; pre-fill every step from existing config |

**Wizard flow.**

1. Start (command, first run, or Setup button).
2. **Adapter** — *"Select your ticket/issue tracking system:"* → **GitHub** (only option
   today). Selection triggers **VS Code GitHub auth** immediately.
3. **Issues source (authenticated user)** — tree-style QuickPick:
   - `"-- Source issues from another GitHub owner --"` → owner input branch (3.b).
   - Separator `"By Repository:"` / `"No repositories found."` + repos for auth login.
   - Separator `"By Project:"` / `"No projects found."` + projects for auth login.
   - Repo vs project pick sets `github.scope` (`repository` vs `project`).
3.b. **Another owner** — input owner login; adapter resolves via **try `user(login)` →
   `organization(login)`** (adapter-specific); list repos/projects for that owner.
4. **Save identity** — first write to `.vscode/verto.config.jsonc` (create `.vscode/`
   if missing): `adapter`, `github.scope`, `github.owner`, `projectNumber` or
   `repository`, `ownerType`; repository-scope limitation comments in file. File is
   **identity-only** until step 5 (no audit-seeded `fieldMappings` or
   `displayStatusGroups`).
5. **Audit & enrich** — run §4.6.6 audit; merge adapter defaults; write
   `fieldMappings`, `ui.displayStatusGroups`, explanatory comments and brief
   optional-override blocks (`priority`, `isDeliverySlice`, `personas`, `issueFilter`,
   …); **preserve JSONC comments** on write (no blind `JSON.stringify`).
6. **Open editor** — open config in VS Code.
7. **Post-setup** — auto-`refresh()` panel; host watches config file (debounced
   refresh on save, **500–1000 ms**; watcher fires on **create** and change so the
   first write during setup is observed).

**Incomplete config.** Between steps 4 and 5, or if setup is abandoned after step 4,
the identity-only file is **not** a valid load target. `configLoader` classifies it as
**incomplete** (distinct from missing and schema-invalid) and routes to the Setup
button — it must not merge adapter defaults at runtime and load with silently
degraded mappings.

**Discovery errors.** `listRepositories` / `listProjects` failures during step 3
surface as wizard errors (user notification, QuickPick closes cleanly) — not as an
empty list indistinguishable from "no repos/projects".

**Config errors → Setup button.** `configLoader` throws typed errors (missing /
incomplete / invalid). `panelManager` maps only those three to `'error'` messages
with `setupRequired: true`; auth and API failures send `'error'` without
`setupRequired` (Retry only).

**Only adapters with a wizard.** The wizard (and "incomplete") applies to adapters
whose registry entry has `setup` (§4.6.5) — GitHub today. One completeness rule: an
adapter with a wizard decides when its file is complete (GitHub: ≥ 1 `fieldMappings`
entry); any other adapter is complete once its config validates (`{ "adapter":
"fissue" }` loads with the defaults). Setup is offered when the configured adapter has
a wizard **or no adapter can be read from the file** (missing, unparseable, `adapter`
missing or unknown). A readable but invalid config of an adapter without a wizard shows
the error with a hint to edit the file. The *"Config exists — re-run setup?"* check uses
the same rule.

**Auth vs owner.** GitHub session (token) is separate from `github.owner` (API identity).
The authenticated user may configure Verto for another owner's project/repo when permitted.

**Adapter discovery APIs (GitHub).** `listRepositories`, `listProjects` (paginated),
`resolveOwner` — used by the wizard; audit/bootstrap remains `auditProjectScope` /
`auditRepositoryScope`.

**Re-audit.** Deferred beyond initial wizard. When added, merge must not blindly
overwrite user-edited `fieldMappings` entries or `displayStatusGroups`.

**Not configured by setup.** Parsed-requirements toggle, write-back draft, panel lens
state — `workspaceState` at runtime.

#### 4.6.10 Second adapter: fissue

**Phase 6.** [fissue](https://github.com/manmilani/fissue) is a separate tool (core
library, CLI and VS Code extension; own repo): a local, file-based tracker with one
Markdown file per ticket (YAML frontmatter) under `.fissue/tickets/`, gitignored and
single-user. Its full design is in
[fissue's DESIGN.md](https://github.com/manmilani/fissue/blob/main/DESIGN.md) (Verto
integration: §7). The Verto side:

Package `@verto/adapter-fissue` (`packages/adapters/fissue`, same layout as GitHub's,
§4.6.2). Reads and writes (write-back below and §4.6.11).

- **Access:** in-process through fissue's API object, passed into the adapter, so the
  adapter package depends on neither `vscode` nor fissue: it declares structurally the
  part of the API it uses, and checks `apiVersion` (1). The extension host gets the API
  from the fissue extension (`vscode.extensions.getExtension('manmilani.fissue')` →
  `activate()` → exports); `scripts/load-project.mjs` imports fissue's built core
  (`--fissue-core`). No CLI spawning or output parsing.
- **One read per load:** `projectState(root, { bodies: true })` — one fissue `sync`,
  giving config, tickets (values, file `path`, Markdown `body`) and warnings. fissue's
  warnings are logged only (fissue shows them as diagnostics). The adapter shares that
  one call between `checkFields`, `fetchStatusOptions` and `loadProject`; the host
  creates a fresh adapter per load.
- **Soft dependency:** no `extensionDependencies`. Verto looks fissue up at runtime; if
  it is missing or disabled the load fails with "install its .vsix (or enable it), then
  refresh". A setup-wizard option that detects or installs fissue and picks or inits a
  project is planned (IMPLEMENTATION.md Phase 6.5). Verto never initialises a fissue
  project automatically.
- **Config:** `adapter: "fissue"` and an optional `fissue` block
  `{ root?, fieldMappings? }`, merged like any adapter block (§4.6.3). `root` (default
  `"."`) is resolved against the workspace folder; fissue's `findProjectRoot` then walks
  up from it, like the CLI. No project → "No fissue project at/above <path>; run
  `fissue init`". `{ "adapter": "fissue" }` alone is a complete config.
- **Values:** a ticket's values are its frontmatter values plus `body` (the Markdown
  body), interpreted by the fissue field's own `type` (fissue's definitions are the only
  source of truth): `number` by fissue's YAML 1.2 number syntax (non-finite → `null`);
  `boolean` by `true/True/TRUE`, `false/False/FALSE`; `text`/`date`/`select` as the
  string. Shape: a single field takes a string, an `isArray` field a string (→ one-item
  list) or a list of strings; any other shape is `null`. A key with no definition is
  read as text. Then the shared mapping tail applies (§4.6.4). `ticketFields` keys follow
  the mapping keys, e.g. `assignees` (GitHub's default is `assignee`; nothing in Verto
  reads either by name).
- **Fields:** fissue's native fields carry GitHub `Issue` names and its user-added
  fields are usually `kind: "issueField"`, so mappings read as for GitHub. fissue's
  `kind` is informational and names are unique, so the field check (§4.6.4) **finds
  `from.field` by name only**: an undefined base field is `missing` (scope: fissue's
  `config.json`), a `projectV2` source is `unsupported`, a kind mismatch is fine.
- **System mappings:** `id` = fissue ticket ID; `title` (empty → `id`); `isDone` =
  `state === "CLOSED"`; `isDeliverySlice` = no loaded ticket lists it in `subIssues`
  (one hierarchy source; fissue's `sync` keeps `parent` in step); `childIds` =
  `subIssues`; `prereqIds` = `blockedBy ∪ subIssues`; `created_at` from `createdAt`;
  `ticketUrl` = the ticket file's `file://` URL (opened in the editor, §4.8);
  `nodeOrigin: "fissue"`; personas as GitHub. Edges: `blocking` from `blockedBy`,
  `parent-child` from `subIssues`.
- **References:** links are kept only between distinct loaded tickets; a reference to an
  ID that isn't loaded, or to the ticket itself, is dropped (one log line per load).
  Longer cycles are left to `validateGraph`, which fails the load as for GitHub; they are
  likelier with fissue, since nothing prevents them.
- **Duplicate IDs** (same exact ID text): the first in fissue's list order is loaded,
  the rest are skipped and logged.
- **Status options** for the status universe (§4.6.3) are the options of the `select`
  field that `fieldMappings.status` maps to.
- **Panel title:** `fissue: <project root folder name>`.
- **Write-back** (§4.6.11) goes through the same API: `updateTicket(root, id, { set,
  add, remove })`, `createTicket(root, { title, parent })`, `addField(root, name, def)`;
  fissue's own `sync` completes inverse links (`blocking`, `subIssues`). Writes use the
  instance's one `projectState` read (the host's pre-write reload).
  - **Resolve** (shared by `checkChange` and `writeBack`): a mapped key writes through
    its mapping (`projectV2` refused); a dot entry (e.g. `labels.persona`) becomes
    `remove`/`add` on its base list (`dotItemsDiff`; a text base such as `body` is
    refused); a direct field gets `set` of the reverse-mapped value. Unmapped:
    `title` → `title`; `isDone` → `state` `CLOSED`/`OPEN`; `personas` → as
    `labels.persona`; other keys → their **default write mapping**
    (`fissueWriteMappings`: `priority` ← `issueField priority`, number), else refused.
    Links → `add`/`remove` on `blockedBy`.
  - **Writable** = the value reads back through the mapping (§4.6.11) **and** fissue's
    field takes it (its type by fissue's interpretation rules; `select` options). A
    missing field is fine (it is registered); a missing **system** field (`title`,
    `state`, `labels`, `blockedBy`, `parent`, `subIssues`) fails the change.
  - **Registration:** a missing field gets `kind` = the mapping's (`issue` stays
    `issue`, else `issueField`); `values` present → `select` with the `values` keys as
    options; else the entry `type` (`select`/`iteration` → `text`), else the key's
    canonical type (`priority` number, `isDone` boolean, else text); `isArray` from the
    entry (a dot base: list of text).
  - **Order:** resolve all → fail conflicts and changes depending on a refused create →
    one confirmation (fields to register + mappings to add) → `addField` each → creates
    in draft order (parents remapped) → one `updateTicket` per ticket.
    `changed-on-disk` is retried once. A create that throws is counted as created when
    a fresh `projectState` holds a new ticket (not in the pre-write state, not already
    claimed) with its title and parent; else it fails, with every change that refers
    to its temp id.
  - With `isDone` mapped from `status`, closing writes `status` only (fissue `state`
    untouched), and reopening needs a `values` entry that reads as `false` (else set`n    `status` instead). A failed title rename after fissue wrote the values isn't retried (the
    retry finds nothing to change).

#### 4.6.11 Write-back

Edits made in the panel are written to the tracker through the adapter. The shared part
(change model, draft, preview, host flow) is adapter-neutral; an adapter opts in with
`checkChange` + `writeBack`. fissue writes (§4.6.10); GitHub doesn't yet, so its edits
stay a local preview.

**Editable:** `title`, `priority`, `status`, `isDone` (done/reopen), `personas`,
blocking links (add/remove), new child tickets. Parsed nodes, deletions, bodies and
`stateReason` are not editable.

**Change model** (`@verto/core` `changes.ts`):

```ts
type EditableKey = 'title' | 'priority' | 'status' | 'isDone' | 'personas'
type VertoChange =
  | { type: 'set'; nodeId; key: EditableKey; value }
  | { type: 'link'; nodeId; blockerId; add: boolean }      // blockerId blocks nodeId
  | { type: 'create'; nodeId: 'new:<n>'; parentId; title } // temp id until written
type ChangeState = 'applied' | 'noop' | 'notLoaded' | 'invalid'
```

Helpers: `sameTarget`, `upsertChange`, `discardChanges` (dropping a create drops every
change referring to its temp id, transitively), `nextTempId`, `remapNodeIds`,
`applyChanges(graph, changes, implied?) → { graph, states }` (`implied`: the other keys a
`set` moves, rule 3), `parseChange` (webview input).
`applyChanges` is pure and changes ticket nodes only: `set` (priority clamped 1–9),
`link` (blocking edge + `prereqIds`; removing keeps the prereq if it is also a child or
raw requirement; no-op judged on the blocking edge), `create` (a child node with
priority 5, the parent's `nodeOrigin`, `ticketUrl: 'verto-draft:<tempId>'`, plus the
parent's `childIds`/`prereqIds` and a `parent-child` edge).

**Rules:**

1. **One draft per project.** The draft is an ordered list of changes in
   `workspaceState` (`verto.drafts`), keyed by adapter id + the adapter block without
   `fieldMappings` (merged config). Each entry keeps its own last write error.
   **Immediate mode** (`verto.writeBack.mode`, default `draft`) is the same draft,
   written after each accepted edit.
2. **One change per target** (same type, node and key / blocker; creates by temp id).
3. **Preview = the loaded graph with the draft applied**, in order. A `set` also moves
   every other node key mapped from the same tracker field, read back from the value it
   writes (e.g. `status` = Done flips an `isDone` mapped from `status`); one that reads as
   null is left as it was.
4. **No-op changes disappear** from the draft on every view build (e.g. add then remove a
   link; personas compare as sets; priority 5 on a ticket without one).
5. **An edit is accepted only if valid now:** every node it refers to is a ticket node
   of the preview (loaded or new), titles are non-empty, the adapter (if it writes)
   accepts it (`checkChange`, which includes a conflict with another draft change,
   rule 11), and the preview still validates (e.g. no cycle). A
   refused edit leaves the draft as it was and shows why.
6. **An invalid draft never locks the panel:** the view uses the longest draft prefix
   that validates; the rest are marked `invalid` and can be discarded. Nothing is
   written while an entry is invalid, and every write first reloads the tracker and
   rebuilds the preview, aborting if it no longer validates.
7. **Changes for nodes not loaded are kept** (`notLoaded`), not applied.
8. **Reverse mapping mirrors the read path.** A value is writable if it **reads back**
   as itself (`readBack` = the mapping tail, then priority's clamp) and the tracker
   field accepts it. With `values`, the first tracker value that reads back is written
   (`reverseMappedValue`); none → refused. An unmapped key writes its system field, or
   its adapter's default write mapping.
9. **A write through a default mapping adds it to the workspace config**
   (`insertFieldMappings`, a formatting-preserving `jsonc-parser` edit; on failure the
   error names the entry to add by hand), so the next load reads what was written. One
   modal asks for it together with any field registration; a decline fails those changes
   and is remembered until the next Write back click.
10. **Writing:** the whole draft is sent; every change not reported failed was written
    and leaves the draft; failed ones stay with their error, which is shown only when it
    differs from the stored one. Written creates' temp ids are remapped in what remains.
11. **Conflict policy: last write wins** per change, no merging with tracker-side edits.
    A tracker concurrency error fails just that change (kept for retry). Changes on one
    ticket merge into one update unless they **conflict** — two `set`s of one field
    with different values, an item one adds and another removes, or a `set` with an
    `add`/`remove` of the same field (a dot entry counts as a `set` of its dot path) —
    then both fail ("conflicting changes to <field>").
12. **Discarding a create discards the changes that refer to its temp id.**

**Adapter contract** (§4.6.5): `checkChange?(config, change, draft) → string | null`
(edit-time, conflicts with `draft` included, no writes; a missing tracker field is not a reason) and `writeBack?(config, changes,
hooks) → { failed, createdIds, addMappings }`, with `hooks.confirm({ register,
addMappings })` for the one setup prompt. Both get the full config (before any
load-time skip).

**Config helpers** (`@verto/config` `mapping.ts`): `readBack`, `reverseMappedValue`,
`dotItemsDiff` (the reverse of the labels path of `applyParsedFieldMappings`: removes
other `sub:` items and bare `sub`, adds the missing ones — written as `remove` + `add`, so
other labels survive), `statusOptionsFor` (tracker options read through the status
mapping: the values the panel offers), `writableLevels` (priority levels some tracker
value reads back as; `null` = all).

**Host flow** (`panelManager.ts`, `draftSession.ts`, `draftStore.ts`):
`loadProjectGraph` keeps the last load (adapter included) and `buildView(load, changes)`
rebuilds the view from it, so edits don't reload the tracker; `body` is stripped from
the **sent** bundle by copy. Edits, discards and writes run one at a time; while a
write runs, edit controls are disabled and an edit that still arrives is refused with a
warning. **Write back** → reload (missing mappings skipped without a prompt) → rebuild
with the draft (invalid → abort) → `adapter.writeBack` → add mappings → keep the failed
changes → reload. The old Phase 4 priority overlay (`verto.priorityOverlay`) is moved
once into the first loaded project's draft (ids in that graph only).

**Webview:** a toolbar **draft bar** (N pending, list with state/error and discard ×,
**Write back** — disabled with the reason when the adapter can't write or the draft is
invalid — and **Discard all**); a **node editor** in the NCN focused-node detail
(title, status — a select of `statusOptions` — done, priority, personas, blockers ×/+,
new child; an "edited" pill on nodes with pending changes); the journey priority editor
shows each slice's priority with the draft applied and a pending marker ("—" discards).

### 4.7 State: tickets vs. workspace

- **In tickets (shared, versioned with the backlog):** workflow status (canonical
  `status` when mapped), done signal (`isDone`), dependency links
  (parent/child and BlockedBy/Blocking), body content (including **Raw Requirements**
  between `RAW_REQ:BEGIN` / `RAW_REQ:END`), vertical narrative (DESC outcome,
  `persona:<value>` labels → `personas`), and — as much as possible — **vertical priority**. Rule of
  thumb: *if a teammate should see it without opening your IDE, it's in the ticket.*
- **In workspace config** ([`.vscode/verto.config.jsonc`](./.vscode/verto.config.jsonc)):
  adapter selection; repo/project identifiers; **`fieldMappings`** (field bindings
  and value maps for all fields, including optional overrides for system-mapped fields
  such as `isDeliverySlice` and `isDone`); optional runtime ID caches. Rule of thumb:
  *if it's "how this workspace is wired to its tracker," it's workspace config.*
- **In workspace/global editor state (transient UI):** refresh interval, selected
  vertical, current lens, graph pan/zoom, **the write-back draft** (pending edits not yet
  written, per project, §4.6.11), NCN highlight/focus and table-view
  preference — not committed to `verto.config.jsonc` unless we later decide otherwise.
- **Secrets** (GitHub PAT, etc.): editor or environment settings — **never** in
  `verto.config.jsonc`.

### 4.8 Verto for VS Code (extension shell)

- **Product name:** Verto. **Extension display name:** **Verto**. **Extension
  identifier:** `manmilani.verto` (`publisher`: `manmilani`, `name`: `verto`).
  **npm scope:** `@verto/*` — monorepo-only / private; no npm publish action
  required. **Distribution:** private `.vsix` (not Marketplace).
- **Panel location:** **editor tab** via `WebviewPanel` (`createWebviewPanel`) —
  not sidebar, not custom editor.
- **NCN graph UI stack:** **@xyflow/react** (React Flow) for rendering; **ELK**
  (`elkjs`) as the background layout engine. **Phase 4:** pan/zoom enabled
  (`panOnScroll`, `zoomOnScroll`); journey highlight + click-to-focus neighbourhood.
- **Bundlers:** extension **host** → **esbuild**; **webview** → **Vite**. CSP-safe
  webview bundle; no inline scripts.
- **Standard pieces only:** extension manifest + activation, a **WebviewPanel**
  hosting a bundled React app, `postMessage` for host↔webview communication,
  `workspaceState`/`globalState` for persistence, and the built-in **GitHub
  authentication provider** for the GitHub adapter.
- **Host responsibilities:** all I/O (adapter calls, GitHub GraphQL, file reads),
  auth, secrets, **host load pipeline** (`adapter.checkFields` → `adapter.loadProject` → `@verto/text-parser`
  → draft changes → filter → validate →
  `buildDeliveryMapBundle` — §4.6.5, §4.6.8), the write-back draft and writes
  (§4.6.11), **Enable Parsed Requirements** toggle persistence, and UI state. Adapters
  do **not** materialize parsed nodes or build bundles.
- **Settings:** `verto.writeBack.mode` — `draft` (default: edits collect until
  **Write back**) or `immediate` (each accepted edit is written right away).
- **Webview responsibilities:** a view of the `DeliveryMapBundle`, config payload,
  and host-derived metadata (`projectName`, `priorityOptionHints`, `statusOptions`,
  `writableLevels`, the draft).
  **Delivery Map** and **NCN graph** lenses with shared chrome
  (`components/ui.tsx`: pills, stats, data tables, status dots/legend). **Phase 4:**
  journey priority editor (dropdown), implementation-order / leverage table toggle,
  NCN pan/zoom/focus, status-group colouring on all nodes via `displayStatusGroup.ts`
  + `theme.ts`. Panel state uses a thin hook over `postMessage` + host persistence.
  Theme via VS Code CSS variables.

**Host↔webview message protocol.** All communication between the extension host and
the webview uses a typed `postMessage` contract defined in
`packages/extension/src/shared/protocol.ts`, imported by both host and webview build
targets. `PersistedPanelState` — `{ lens: 'deliveryMap' | 'ncnGraph'; focusedNode?;
ncnHighlightedSliceId?; ncnFocusedNodeId?; ncnTableView?: 'implementationOrder' |
'leverage' }` (`focusedNode` = selected delivery-slice id in the Delivery Map lens;
NCN highlight/focus fields are separate from Delivery Map slice selection).

*Host → webview:*

| Message `type` | Extra payload fields | Sent when |
|---|---|---|
| `'update'` | `bundle: DeliveryMapBundle`; `displayStatusGroups: DisplayStatusGroup[]`; `showOthersColumn: boolean`; `displayStatusGroupTooltips: Record<string, string>`; `parsedEnabled: boolean`; `projectName: string`; `priorityOptionHints: PriorityOptionHints`; `statusOptions: string[]`; `writableLevels: number[] \| null`; `draft: { entries: { change, state, error?, label }[]; canWrite; mode; writing; adapter }`; `restoredState?: PersistedPanelState` | Initial load, refresh, parsed toggle, draft change, write, or mode change |

*Webview → host:*

| Message `type` | Extra payload fields | Sent when |
|---|---|---|
| `'ready'` | — | Webview mounted; host holds the first `'update'` until this arrives |
| `'setParsedEnabled'` | `enabled: boolean` | User clicks the **Enable Parsed Requirements** toggle in the webview toolbar |
| `'edit'` | `change: VertoChange` (a create's `nodeId` is ignored; the host assigns the temp id) | User edits a ticket; host checks it (§4.6.11 rule 5), adds it to the draft, rebuilds; immediate mode writes |
| `'discard'` | `changes?: VertoChange[]` (none = all) | User discards pending changes |
| `'writeBack'` | — | User clicks **Write back** |
| `'persistState'` | `state: PersistedPanelState` | Lens switch, focused-node change, NCN highlight/focus, or table-view toggle (debounced) |
| `'openTicket'` | `url: string` (a node's `ticketUrl`) | User clicks a ticket title link. The host opens `ticketUri(url)` with `vscode.open`: only `http`/`https` (browser) and `file:` (editor, fragment dropped — e.g. a parsed node's `#raw-req-n`); anything else is ignored and logged |

`displayStatusGroups`, `showOthersColumn`, and `displayStatusGroupTooltips` travel
in `'update'` alongside the bundle — **not** inside `DeliveryMapBundle` — keeping
`@verto/core` free of config concerns. User groups come from `config.ui.displayStatusGroups`;
tooltips and **`others`** visibility are computed in `loadPipeline` from config,
the loaded graph, project Status options, and `fieldMappings`.

**Adapter defaults programmatic export.** The adapter registry imports adapter defaults
directly as a JS object rather than reading files at runtime (safe for the bundled
extension and for tests). Each adapter package therefore exports its defaults
(`githubAdapterDefaults`, `fissueAdapterDefaults`) from `src/index.ts`; esbuild
inlines them at build time. `defaults.verto.config.jsonc` remains the human-readable
source; the exported object mirrors it exactly.

### 4.9 Data source of truth vs declarative formats

**Tickets (via adapters) are the source of truth.** All delivery state — workflow status, done signal (`isDone`),
dependencies (including parent/child), vertical priority, narrative — lives in
the issue tracker (or file-based ticket store) and is loaded through adapters.

A **declarative bundle** (e.g. YAML/JSON) is **not** a parallel data model and
**not** something teams maintain by hand alongside tickets. If used at all, it is
only as:

- an **export/cache** snapshot produced by an adapter; or
- a **validation artefact** in CI (schema + dangling-dependency checks).

**`verto.config.jsonc` is wiring, not backlog data.** It holds adapter selection and
**fieldMappings** (how tracker fields map to `VertoNode`) — not issue titles,
status values, or dependency graphs. Those live in tickets and are loaded on each
`loadProject()`.

The canonical schema governs what adapters **produce** for `@verto/core`; it is
not a separate user-editable project file in the ticket-first workflow.

### 4.10 Future extensibility

- Additional **adapters** (Jira, others) behind the same interface.
- **Write-back for more adapters** (GitHub next; the shared part is in §4.6.11).
- Additional **lenses** (e.g. timeline, risk heatmap, sprint/board views) over
  the same core.
- **Multi-project** support via workspace config.
- A future **standalone web shell** reusing `@verto/core` for
  non-IDE/stakeholder viewing, without disturbing the extension.
- **CI validation** of adapter export snapshots against the canonical schema
  (dangling-dependency checks, etc.).

---

## 5. Knowledge Gaps

Open questions only; resolved items are recorded in
[DESIGN-History.md §6](./DESIGN-History.md#6-resolved-knowledge-gaps). Detail lives in
the body sections cited — this list is the index.

### 5.1 Domain model & ticket schema

- **Link metadata (other reasons).** Decomposition vs cross-cutting prerequisite
  labels for non–parent-child / non–blocking edges (`VertoEdge.reason` beyond the
  three known values).
- **Additional fields.** Estimates, iterations/sprints — deferred; decide if/when they feed ordering.

### 5.2 Delivery Map presentation & decomposition

- **Requirements ↔ child ticket linking.** Explicit mechanism — **deferred**; union
  is concatenation only, no dedupe.
- **Decomposition CTA.** UI action when a slice has raw requirements but no children
  — deferred.
- **Auto-promote parents.** Fallback when no `isDeliverySlice` nodes — deferred.
- **Decomposition workflow.** How child tickets are created when breaking down a
  parent (manual command, template, UI action, auto-link back to parent).
- **Migrate legacy `REQ:` markers.** Existing tickets with old markers — ignored for
  now; new work uses `RAW_REQ:`.
- **The ~5% node differences.** What fields or behaviours differ between nodes
  if ~95% are structurally identical? (e.g. vertical designation,
  narrative template sections.)

### 5.3 Adapters & data

- **GitHub operational details.** ID cache: in-memory only for Phase 2 (workspace-
  persisted deferred to Phase 5). Rate-limit: exponential backoff (100 ms × 2ⁿ, max 3
  retries). Pagination: cursor-based, fetch all pages (top-level + nested connections).
- **Adapter capability differences.** How the core/UI degrade gracefully when an
  adapter lacks a feature (e.g. no custom fields, no native blocking links). Partially
  addressed: the panel title falls back to the adapter id when an adapter has no
  `projectTitle`; `requireGitHubConfig` gives
  a specific error when `github` is missing for the GitHub adapter.
- **GitHub issue fields in setup and write-back.** The audit and setup wizard
  (§4.6.6, §4.6.9) do not yet discover org issue fields or seed `issueField` mappings;
  GitHub write-back (issue fields included) is not designed yet. The field check covers
  only the configured owner's org, so issue fields of issues from other orgs (e.g. in a
  user-owned project) are not yet readable.
- **Status options beyond ProjectV2.** The status universe (§4.6.3) takes ticket
  status options from the Project's Status field (GitHub) or from the mapped fissue
  `select` field (§4.6.10); when GitHub's `status` maps to an `issueField` select, its
  options should come from that field's definition.

### 5.4 Extension & UI

- **Large-graph performance.** Deferred — evaluate after Phase 4 when the
  interactive graph can be dogfooded (see IMPLEMENTATION.md unplanned backlog).
- **Agent / chat workflow integration.** How the Verto panel relates to agent
  workflows — deferred.

### 5.5 Product & process

- **Repository strategy.** Where the core + extension live relative to consuming
  projects (monorepo vs. standalone repo).
- **Team vs. personal state.** Whether priorities/views are per-user, per-team,
  or committed for shared alignment — reconciled with "priority in tickets."
- **Multi-project / multi-repo** scope and timing.
- **Definition of "delivered" for a vertical** and any metrics for the success
  criteria in §2.4.

---

## 6. Implementation Plan

The build plan is maintained in a separate document to keep this file focused on
intent and design decisions. Full phase detail, deliverables, and open decisions:
**[IMPLEMENTATION.md](./IMPLEMENTATION.md)**. This section is an index only.

Summary of phases:

| # | Phase |
|---|---|
| 0 | Repository & tooling scaffold |
| 1 | `@verto/core` algorithms |
| 2 | GitHub adapter — read-only |
| 2.5 | Parsed requirements & Delivery Map model |
| 3 | VS Code extension — read-only panel |
| 4 | Full UI fidelity |
| 4.5 | Setup wizard & config bootstrap |
| 5 | Write-back (shared framework; GitHub write-back remaining) |
| 6 | fissue adapter (read + write) |
