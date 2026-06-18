# Verto — Design & Thinking Document

> **Status:** Living draft. This document captures our current thinking about
> **Verto** — a project-management tool for vertical-slice delivery from your
> issue graph. It is the evolving picture of **why** we are building it, **what**
> it should achieve, and **how** we intend to build it. Sections will be expanded
> and revised as decisions solidify.

> **Paths:** Unless stated otherwise, all file and folder paths in this document
> are **relative to the Verto project root** (the folder containing this file).
> See [README.md](./README.md) for the repository layout.

> **Note on the deprecated original canvas:** The
> [`deprecated_original_canvas/`](./deprecated_original_canvas/) folder contains
> an **unmodified, verbatim copy** of the existing *Rustybu Vertical Delivery Map*
> canvas (`.canvas.tsx` plus its `.data.json` session state and `.status.json`
> build artifact). It is included **only as an initial migration aid** when
> starting work on Verto for VS Code and `@verto/core` — not as an ongoing
> reference. It will eventually be **removed**. It is **not** a source of truth,
> not a specification, and not a template to be faithfully reproduced. Where this
> document and the canvas disagree, this document wins.

---

## Table of Contents

1. [Background — the existing Rustybu canvas](#1-background--the-existing-rustybu-canvas)
2. [Verto — System Intention / Goal](#2-verto--system-intention--goal)
3. [High-Level Abstract Solution Design](#3-high-level-abstract-solution-design)
4. [Solution System Design](#4-solution-system-design) — adapter architecture: [§4.6.1](#461-canonical-vs-tracker-native-models)–[§4.6.8](#468-parsed-requirements-verto-text-parser)
5. [Knowledge Gaps](#5-knowledge-gaps)
6. [Implementation Plan](#6-implementation-plan)

---

## 1. Background — the existing Rustybu canvas

### 1.1 What it is

The starting point for this whole idea is a single Cursor **canvas** file,
[`deprecated_original_canvas/rustybu-vertical-delivery-map.canvas.tsx`](./deprecated_original_canvas/rustybu-vertical-delivery-map.canvas.tsx)
(~1,800 lines), preserved verbatim in `deprecated_original_canvas/`. A Cursor canvas is a
self-contained React component compiled
by the IDE and shown beside the chat; it may only import from `cursor/canvas`,
cannot do any network/`fetch`, and embeds **all of its data inline**.

The canvas renders **one specific product — Rustybu (a childcare-management
SaaS) — as a delivery map**, with two toggleable "lenses" over the *same* data:

- **Delivery map** (`MapView`) — the product expressed as **vertical journeys**
  (e.g. "Childcare Business Onboarding & Setup", "Family Onboarding &
  Enrollment", "Continuous Compliance & Licensing", "Billing & Payments", …).
  Each journey has a `persona`, an `outcome` narrative, and an ordered list of
  **steps**, where each step has a four-valued `status` (`done` / `partial` /
  `designed` / `missing`) and a free-text `note`. The view also surfaces
  per-journey completion, overall completion, and a list of cross-cutting
  **"black boxes"** (absent systems that block many journeys).
- **Dependency graph / NCN** (`GraphView`) — the *same* product re-expressed as
  a network of **work-items (nodes)**. Each node has `id`, `label`, `desc`,
  `status`, `verts` (which journeys it serves) and `deps` (the nodes that must be
  done before it). An arrow `A → B` means "A is a **necessary condition** for B".
  On top of the graph the view computes readiness, transitive **upward
  leverage**, per-vertical closure completion, a user-settable **custom journey
  priority** list, and a priority-weighted **Implementation order** table.

### 1.2 Why it was created

It was a **quick, pragmatic attempt to bring clarity to the state of one
product**: where Rustybu is strong, where it is weak, what is genuinely built
versus merely specified versus entirely missing, and — given limited capacity —
**what to build next to unblock the most value**. It grew organically from that
need, accreting fields and views as questions came up, rather than being designed
up front as a reusable system.

### 1.3 How it works today (and why that's "bespoke")

The canvas is effective for its one purpose but is, by its own nature, a
**throwaway, single-project artifact**:

- **Data is hard-coded inline.** `JOURNEYS`, `NODES`, `BLACK_BOXES`, and the
  `STATUS` legend are large literal arrays compiled into the component. There is
  no external data source; editing the picture means editing source code.
- **Two parallel hand-maintained models.** Journeys' `steps[]` and the graph's
  `NODES[]` describe overlapping reality but are **not mechanically linked** —
  they are kept aligned by human curation. Many step names mirror node labels,
  but nothing enforces it. This is the single biggest source of drift.
- **Steps are a first-pass scope sketch, not work items.** The journey steps were
  an early way to *grasp the scope* of each vertical. In a real project most of
  them would become individual tracked work items (issues), while the genuinely
  "fuzzy" remainder is just envisioning notes. The canvas conflates both in one
  `steps[]` array.
- **Bespoke runtime mechanisms.** Session state (selected journey, chosen view,
  graph pan/zoom, and the custom `journeyPriorities`) is persisted through the
  canvas-only `useCanvasState` hook into a sidecar `.canvas.data.json`. Pan/zoom
  uses module-level mutable globals and hand-bound non-passive wheel listeners.
  Status colors are partly hard-coded hex values rather than theme tokens. None
  of this is portable beyond the Cursor canvas host.
- **Locked to the canvas host.** Because it can only import `cursor/canvas` and
  cannot fetch data, it cannot read from GitHub, a database, or the filesystem.

### 1.4 What it nonetheless proved

Despite the above, the canvas validated the **core ideas** this project is built
on: modelling a product as vertical journeys *and* as a necessary-conditions
graph; using four-valued status; computing readiness and leverage; and turning a
human priority ordering into a concrete, dependency-respecting delivery sequence.
The *concepts* are sound and reusable; the *implementation* is not.

### 1.5 Status of this artifact in the project

**Deprecated — initial migration aid only.** The copy in
`deprecated_original_canvas/` explains how we arrived here and may help when
porting concepts and UI behaviour into Verto. It is explicitly **not** the source
of truth for the **canonical schema, algorithms, or data model** described in the
rest of this document, and **will eventually be deleted**.

**Exception — Phase 4 UI outcomes.** For Phase 4 “Full UI fidelity”, the deprecated
canvas is the authoritative **behavioural** reference for **what the user
experiences** (interaction flows, layout, tables, focus/highlight behaviour). See
[IMPLEMENTATION.md — Phase 4](./IMPLEMENTATION.md#phase-4--full-ui-fidelity) for the
fidelity rule and canvas → Verto mapping. Full UI fidelity does not mean to copy the canvas’s
implementation (code structure, state mechanisms, inline data, Rustybu domain
content).

### 1.6 How to read `deprecated_original_canvas/` (during early migration only)

The deprecated original canvas is **not** a specification for schema or
architecture. While building Verto, you may consult it to understand proven
**concepts** and **user-visible UI behaviour** — not Rustybu domain content, the
target data shape, or how the canvas implemented its solution internally. For
Phase 4 NCN and planning UI, treat `GraphView` in the canvas as the outcome
reference when design docs are silent (see IMPLEMENTATION.md Phase 4 fidelity
rule).

**Read for structure and behaviour:**

- Data shapes: `JOURNEYS`, `NODES`, `BLACK_BOXES`, `STATUS` (top of
  [`deprecated_original_canvas/rustybu-vertical-delivery-map.canvas.tsx`](./deprecated_original_canvas/rustybu-vertical-delivery-map.canvas.tsx))
- Delivery map lens: `MapView`
- NCN graph lens: `GraphView`, `closureFor`, `isReady`, `buildExecutionOrder`
- Session state example:
  [`deprecated_original_canvas/rustybu-vertical-delivery-map.canvas.data.json`](./deprecated_original_canvas/rustybu-vertical-delivery-map.canvas.data.json)
- Canvas evolution context (optional):
  [`deprecated_original_canvas/chat_summary_1__060d34f9.md`](./deprecated_original_canvas/chat_summary_1__060d34f9.md)
  (canvas authoring),
  [`deprecated_original_canvas/chat_summary_2__e4e7087f.md`](./deprecated_original_canvas/chat_summary_2__e4e7087f.md)
  (Verto system design)

**Ignore:**

- Rustybu-specific journey names, step notes, and black-box prose
- Inline data as something to reproduce — the target system loads from ticket
  adapters

**Important — deprecated original vs target model:**

The deprecated original canvas uses a separate `verts[]` field on nodes to associate
work-items with journeys, and hard-coded `steps[]` with status per journey. In
the **target Verto system**, all tickets are **equal graph nodes**;
parent/child and BlockedBy/Blocking are unified dependency links; vertical/epic/
journey are equivalent semantic labels on certain nodes; and **raw requirements**
(parsed from ticket bodies) plus **child tickets** form the unified **Requirement**
list in the Delivery Map (see §3.6–§3.8).

**GitHub adapter reference:** [graphql/github_issues_graphql.agent_prompt.md](./graphql/github_issues_graphql.agent_prompt.md)

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

**Deprecated canvas `steps[]`** mapped conceptually to the **union** of child
sub-issues and raw requirement lines for a slice — shown as a **single pipeline
column** in the Delivery Map (not two side-by-side columns). There is **no
automatic deduplication or linking** between raw lines and child tickets.

**`_rawReqIds[]`** on a parent lists synthetic ids for that ticket's materialized
raw lines. **`prereqIds`** = `_rawReqIds ∪ childIds ∪ blocking` (deduped).
**`childIds`** remains sub-issue ids only. Parsed → parent edges use
`VertoEdge.reason: 'parsed-req'`.

When **Enable Parsed Requirements** is off (global toggle, default **on**), parsed
nodes are **filtered out** of the graph copy used for `buildDeliveryMapBundle()` —
as if they did not exist — including from the Delivery Map pipeline (children only).

### 3.7 Delivery Map lens (vertical-focused presentation)

The Delivery Map emphasises **delivery-slice** nodes (vertical / epic / journey).

**Slice header (canvas fidelity):**

- **Persona** — `personas: string[]` (canonical root field; default `[]`). **Population
  (load time):** the GitHub adapter extracts `personas` per-issue from labels matching
  `persona:<value>` on **any** ticket node — not gated on `isDeliverySlice`. Optional
  **`fieldMappings.personas`** in workspace config overrides label extraction when present
  (no default entry in `defaults.verto.config.jsonc`). See §4.6.7. **Display (Phase 3
  UI):** the Delivery Map slice header reads `personas` from the selected slice node;
  the field may also be populated on non-slice tickets but is not displayed there.
- **Outcome** — display-only: `node._outcome` on the selected slice node — the
  **first paragraph** of its `DESC:BEGIN` / `DESC:END` block, pre-computed by
  `computeBodyFields` in `@verto/text-parser` (§4.6.8). Read directly from the node;
  do not re-parse the body in the webview (`ticketFields.body` is stripped before
  the `'update'` message).

**Requirement pipeline** — one ordered list per slice (like deprecated canvas
`steps[]`), **not** two columns:

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

**Slice picker (Phase 3).** Pills (deprecated canvas pattern).

**Empty states.**

| Situation | UI |
|---|---|
| No `isDeliverySlice` nodes | Empty screen (auto-promote deferred) |
| Slice with no children and toggle off / no raw lines | Empty pipeline |

**Portfolio table, UsageBar, gap callouts (Phase 3 UI).**

- **Portfolio** — per slice, bucket Requirements using `ui.displayStatusGroups` (§4.6.3).
  **Sort:** delivery slices by `deliveryCompleteness[sliceId]` descending (highest
  completeness first). **Primary user** column — `personas` joined (`' / '`) per slice.
  **Slice picker pills:** completion-toned via `buildTone(deliveryCompleteness)` (Phase 4).
- **UsageBar** — same display-status groups as the portfolio table plus an implicit **Other** bucket;
  segment value = **sum of `weight`** (default 1) of requirements in that bucket.
  With default weights this equals a count.
- **Gaps** — requirements that do **not** match any **satisfied group** (`isDoneBucket` —
  §4.6.3). A display-status group is a satisfied group when **any** of its `sources`
  entries has `isDone: true` (for `ticket` and/or `parsed`). A requirement matches a
  group when it satisfies that group's `sources` rules (§4.6.3). **Gaps** = pipeline
  rows that match no satisfied group. (A row with `isDone: true` but a non-Done
  workflow `status` still counts as satisfied if it matches via `isDone: true`.)
- **Removed:** deprecated canvas “The biggest black boxes” section. Term **black box**
  is not used in Verto; unchecked raw status is **`raw`**.

**Enable Parsed Requirements** — global setting (all lenses); persisted in
`workspaceState`; default **on**. Host always materializes parsed nodes, then
filters before bundle when off; rebuilds bundle on toggle.

### 3.8 Glossary

| Term | Meaning |
|---|---|
| **Raw Requirements** | Checklist items between `RAW_REQ:BEGIN` / `RAW_REQ:END`; markdown heading **Raw Requirements** |
| **`raw` status** | Unchecked raw requirement (`isDone: false`) — replaces deprecated “missing” / “black box” *status* |
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
   GitHub Issues      Jira (later)    File-system (later,
   (first adapter)                     e.g. Beans or Backlog.md)
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
- **Pure algorithms**, initially ported from the deprecated original canvas so they
  depend only on the canonical model: `closureFor` (any node), `isReady`,
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

The indicative mapping table below is retained for cross-referencing legacy canvas concepts.

| Concept | Legacy canvas (deprecated original) | Meaning (target system) | Likely ticket home (per adapter) |
|---|---|---|---|
| Graph node | `node.id` | Any tracked ticket — uniform structure (~95% identical across all nodes) | Issue / sub-issue |
| Node identity | `node.id` | Stable identifier | Issue key / stable slug |
| Title / description | `label`, `desc` | Human name + detail (body may include Raw Requirements block) | Issue title + body |
| Delivery status | `status` (4-valued) | Workflow progress — canonical `status` on root (from `ticketFields` via mapper); not used in graph math | Per adapter — e.g. GitHub **ProjectV2 Status** (see §4.6.7) |
| Done signal | *(not in deprecated original)* | Canonical "is done" for graph math — `isDone: boolean`; `isReady = !isDone && all prereqs isDone` | GitHub: native `closed` boolean; parsed raw lines: checkbox |
| Node kind | *(not in deprecated original)* | `nodeType: 'ticket' \| 'parsed'` | Adapter vs `@verto/text-parser` |
| Provenance | *(not in deprecated original)* | `nodeOrigin` — e.g. `'github'`, `'text-parser'` | Per source |
| Persona (slice header) | `persona` | Who the slice serves — `personas: string[]` on any labeled ticket node; slice header reads this field from the selected slice node | GitHub: `persona:<value>` labels on any ticket (default); overridable via `fieldMappings` |
| Raw requirements | journey `steps[]` *(deprecated original)* | Parsed lines → `nodeType: 'parsed'` graph nodes when toggle on | `RAW_REQ:BEGIN` / `RAW_REQ:END` in ticket body |
| ~~Black box~~ | `BLACK_BOXES` | **Removed** — not used in Verto; unchecked raw status is `raw` | — |
| Necessary-condition edge | `deps[]` | Prerequisite nodes (unified) | "blocked by" / "blocks" link **or** parent/child link |
| Parent/child link | *(not in deprecated original)* | Same as NCN edge: child blocks parent | Sub-issue / parent issue relationship |
| Vertical designation | journey `id` / name | Semantic role: deployable, value-adding slice (same as epic / journey) | Epic issue type, label, or field |
| Vertical narrative | `persona`, `outcome` | Slice header: `personas[]` + DESC body (outcome) | `persona:<value>` labels + DESC body markers |
| Vertical priority | `journeyPriorities` | Manager's ranking of verticals | **Ticket field(s)** on vertical nodes |
| Vertical membership *(deprecated original only)* | `verts[]` | Legacy canvas field — **not** used in target system | Replaced by parent/child + unified deps |
| Journey steps with status *(deprecated original only)* | `steps[]` with `status` | Legacy canvas — **not** used directly | Replaced by child tickets + parsed raw lines in Delivery Map pipeline (§3.7) |

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

The agreed mapping that resolves the canvas's conflation:

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

- **Adapter interface (conceptual):** `loadProject(config) → VertoGraph` — ticket
  nodes and edges only; no parsed-requirement enrichment, no bundle computation.
  The **host load pipeline** (§4.6.8) calls `@verto/text-parser`, validates, and
  runs `buildDeliveryMapBundle()`.
- **Later adapters:** Jira; local file-system trackers such as **Beans** or
  **Backlog.md**. All implement the same interface and are selected/configured at
  workspace setup (see §4.6.3–§4.6.6).

The subsections below document the **adapter architecture** agreed for
implementation.

#### 4.6.1 Canonical vs tracker-native models

Two distinct type layers — do not conflate them:

| Layer | Location | Role |
|---|---|---|
| **Canonical** | [`packages/core/src/types.ts`](./packages/core/src/types.ts) (`VertoNode`, `VertoEdge`, `VertoGraph`, …) | What `@verto/core` algorithms consume. Vendor-agnostic. **Authoritative Verto schema.** |
| **Tracker-native** | Per-adapter `system_types.ts` (e.g. `packages/adapters/github/system_types.ts`) | Typed shapes matching **that tracker's** issue layout after a read (e.g. GitHub `Issue`, ProjectV2 field values, issue type, labels, sub-issues, blocked-by). |

**Persistence:** tracker-native types describe an **in-memory (or short-lived cache)
representation during `loadProject`** — not a parallel backlog database. The only
exception is file-based adapters (Beans, Backlog.md), where the on-disk format is
itself the source store (see §4.9).

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
[`graphql/github_issues_graphql.agent_prompt.md`](./graphql/github_issues_graphql.agent_prompt.md),
[`graphql/hmans_beans_graphql.agent_prompt.md`](./graphql/hmans_beans_graphql.agent_prompt.md).
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

**When the extension exists:** first-run setup asks for adapter type and project
identity, runs the **audit/bootstrap** step (§4.6.6), copies merged defaults into
`.vscode/verto.config.jsonc`, and presents the draft for user editing — never
starting from a blank config.

**`@verto/config` package.** The `VertoConfig` TypeScript type, JSON Schema (validated
via `ajv`), and runtime helpers live in `packages/config/` (`@verto/config`):
`validateVertoConfig(raw)` — throws on invalid config; `mergeConfigs(defaults, workspace)`
— field-level replace merge; `parseVertoConfig(jsonc)` / `readVertoConfigFile(path)` —
JSONC-aware parsing. Config files use **JSONC format** (`.jsonc` extension; `//` line
comments allowed). Plain `JSON.parse` and `import ... assert { type: 'json' }` both fail
on JSONC — always use `parseVertoConfig`. `@verto/core` intentionally does not depend on
`@verto/config`; the config type lives in `@verto/config` only.

**`VertoConfig.github` is adapter-conditional.** The TypeScript type declares
`github?: GitHubConfig`. JSON Schema requires only `adapter` at the root; when
`adapter === "github"`, the `github` block is required (`allOf` + `if`/`then` in
`schema.ts`). Non-GitHub adapters (e.g. future Beans) omit `github` entirely. GitHub
adapter code calls `requireGitHubConfig(config)` (`packages/adapters/github/src/githubConfig.ts`)
for a clear error when the block is missing.

**`@verto/config/priority-hints` subpath.** Browser-safe helpers for priority dropdown
labels (`buildPriorityOptionHints`, `formatPriorityOptionLabel`, …) — exported separately
so the webview bundle does not pull in `node:fs` via the main `@verto/config` parse path.

**`ui.displayStatusGroups` (Phase 2.5; renamed from `portfolioColumns`).** UI-layer
config under the root **`ui`** key. Defines how canonical node fields (`nodeType`,
`isDone`, `status`) map to simplified **display group labels** for presentation —
not canonical workflow status (that remains `node.status` from `fieldMappings`).
Resolved in the webview via `resolveDisplayStatusGroup()`; not part of
`DeliveryMapBundle`.

Shape:

```jsonc
{
  "ui": {
    "displayStatusGroups": [
      { "label": "Done", "sources": { "ticket": { "isDone": true, "statuses": ["Closed"] }, "parsed": { "isDone": true } } },
      { "label": "In Progress", "sources": { "ticket": { "isDone": false, "statuses": ["In Progress"] } } },
      { "label": "Raw", "sources": { "parsed": { "isDone": false, "statuses": ["raw"] } } }
    ]
  }
}
```

- Each group has a **`label`** (display name) and **`sources`** keyed by node kind:
  **`ticket`** (child sub-issues) and/or **`parsed`** (raw requirement nodes).
- **Satisfied group (`isDoneBucket`):** any group where `sources.ticket.isDone === true`
  and/or `sources.parsed.isDone === true`. Used for gap detection among other consumers.
  Label `"Done"` is conventional only — detection is structural.
- **Done group:** matches `isDone: true` and/or listed workflow **`statuses`** (e.g.
  map GitHub `Closed` → Done). Default seeds include ProjectV2 Status options from audit.
- **Non-done groups:** only nodes with **`!isDone`** whose `status` is in the group's
  `statuses` list (parsed: `raw` / `done`).
- **Consumers (Phase 3):** portfolio table headers/counts, UsageBar segments, gap
  callouts. **Phase 4** adds NCN node colouring, pipeline status column,
  implementation-order status column, slice/node pills — same matcher throughout.
- **Presentation fields (resolved, Phase 4):** `DisplayStatusGroup` has **no**
  presentation fields. `tone`, `chartColor`, and `weight` are **not** added to the
  config schema. `weight` is dropped from the concept entirely. Status-based colouring
  is baked into the webview by group **array position** — the nth group maps to the
  nth slot in a fixed VS Code theme variable palette in `theme.ts`. The config remains
  purely semantic: `label` + `sources` only.
- **Status display rule (resolved, Phase 4):** `displayStatusGroup` is the display
  vocabulary used **everywhere** — column headers, legends, node colouring, pill tones,
  UsageBar segment labels. When showing an individual node's status value (table cell,
  node label): `"<displayStatusGroup> (<node.status>)"` when `node.status` is present;
  `"<displayStatusGroup>"` when absent. If the node matches no group:
  `"Other (<node.status>)"` when `node.status` is present, else `"Other"`.
- **UsageBar** — same groups plus implicit **Other**; segment value = **sum of
  `weight`** (default 1) of requirements in that group.
- **Gaps** — pipeline rows matching **no** satisfied group (one consumer of
  `isDoneBucket`).
- **Group assignment (matching algorithm):** for each node, walk `displayStatusGroups`
  **in array order**; assign the **first** group whose `sources` entry for that node's
  `nodeType` (`ticket` or `parsed`) matches. Skip groups with no rule for that source
  type. Unmatched nodes → implicit **Other** (portfolio table and UsageBar only — not
  gap detection).
- **Within a `sources.<type>` block:** let `row` be the node. Match if **any**
  specified predicate holds: (`isDone` is present in config and
  `row.isDone === config.isDone`) **or** (`statuses` is present and
  `row.status` is in `statuses`). If only one predicate is present, that predicate
  alone decides. **Non-done groups** additionally require `row.isDone === false`
  before evaluating `statuses`.
- **Merge behaviour:** `mergeConfigs` shallow-merges `ui`; workspace `ui: {}` preserves
  defaults' `displayStatusGroups`; an explicit workspace `ui.displayStatusGroups` array
  fully replaces the defaults array.

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
    "fieldMappings": {
      // --- Canonical VertoNode fields (routed to node root) ---
      //
      // isDone: system-mapped from native GitHub `closed` boolean — no entry needed by default.
      // Override example (derive from a status field instead):
      // "isDone": { "from": { "kind": "projectV2", "field": "Status" }, "values": { "Done": true, "Closed": true } }
      //
      // isDeliverySlice: system-mapped — true for top-level tickets (parent is null).
      // Override to use issue type instead:
      // "isDeliverySlice": { "from": { "kind": "issue", "field": "type" }, "values": { "Epic": true } }
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
    }
  }
}
```

**Mapper routing.** The mapper determines the destination for each `fieldMappings` entry by checking `CANONICAL_VERTO_NODE_KEYS` (exported from `types.ts`):

- Key **in** `CANONICAL_VERTO_NODE_KEYS` → `node[key]` (canonical root, typed)
- Key **not in** `CANONICAL_VERTO_NODE_KEYS` → `node.ticketFields[key]` (passthrough bag, `unknown`)

No config annotation is needed — routing is automatic and transparent. To promote a field from `ticketFields` to canonical: add it to `VertoNode` and `CANONICAL_VERTO_NODE_KEYS`; the same `fieldMappings` entry then routes to the root without any config change.

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
| `personas` (GitHub default) | **`mapper.ts`** — from issue labels `persona:<value>` when no `fieldMappings.personas` override |
| `weight` | **`fieldMappings`** when an effort estimate exists (optional; normalized by `nodeWeight()` — see `completeness.ts`) |

`isDone` and `isDeliverySlice` are populated by the system accessor by default but
may be overridden via an optional `fieldMappings` entry. `priority` and `status`
require user-configured `fieldMappings` bindings when the tracker exposes those
fields (`status` may be absent — see §4.6.5). **`personas`:** GitHub adapter
default is label extraction (above); if **`fieldMappings.personas`** is present in
effective config, label extraction is **skipped** and the standard `fieldMappings`
path populates `personas` instead. If neither applies, **`[]`**.

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
// FieldWritePayload: to be defined when write-back is designed (§4.6.5).
interface FieldAccessor {
  readonly kind: 'system' | 'project';
  getDefinitions(): FieldDefinition[];
  readFromIssue(raw: unknown): Record<string, unknown>;
  toVertoNodeFields(values: Record<string, unknown>): Partial<VertoNode>;
  fromVertoNode(node: VertoNode): FieldWritePayload[];  // write-back — payload TBD
}
```

- **System accessors** — backed by typed `system_types` and fixed mapping rules for
  fields the adapter always handles (e.g. `id`, `title`, dependency links, issue type).
  Populate all system-mapped canonical fields: `prereqIds` and `childIds` from
  blocking/sub-issue relationships; `isDone` from the tracker's native done/closed
  field; `isDeliverySlice` from parent presence; `ticketUrl` from native issue URL.
  **`mapper.ts` stamps `nodeType: 'ticket'` and `nodeOrigin: '<adapter-id>'`** (e.g.
  `'github'`) on every ticket node after accessors run — not via `fieldMappings`.
  **GitHub `personas` default:** when `fieldMappings.personas` is absent, collect
  `<value>` from each issue label whose name starts with `persona:` (prefix match,
  case-sensitive); preserve label list order; dedupe not required. A `fieldMappings`
  entry for `isDone` or `isDeliverySlice` overrides the system-accessor default for
  that field; **`fieldMappings.personas`** overrides label extraction.
- **Project accessors** — backed by `project_fields.ts`, a **config-driven field
  registry** that reads `fieldMappings` from effective config and exposes the same
  `FieldAccessor` interface for all remaining fields — both canonical ones that need
  canonical fields that require or optionally override system-accessor defaults
  (e.g. `priority` — always required; `isDone`, `isDeliverySlice` — optional
  overrides) and non-canonical ticket fields that land in `node.ticketFields`.

**`kind` disambiguation.** `FieldAccessor.kind` (`'system' | 'project'`) describes
which accessor *manages* a field. `from.kind` in `fieldMappings` config (e.g.
`'issue' | 'projectV2'`) describes *where in the tracker* a field lives. The two
`kind` values are in separate namespaces and do not conflict.

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
| **`adapter.ts`** | Orchestrates: load effective config → `client` read → `mapper` → **`VertoGraph`** (ticket nodes only). Does **not** call `@verto/text-parser` or `buildDeliveryMapBundle()`. Write-back (later): canonical change → `mapper` reverse → `client` mutations. |

**Host load pipeline** (extension `loadPipeline.ts`, `scripts/load-project.mjs`) —
not inside adapters:

```
adapter.loadProject(config) → VertoGraph
resolveProjectTitle(config, token)   // adapter-aware panel title (extension host only)
  → runHostPipeline(graph, { parsedEnabled?, priorityOverlay? })
       → materializeParsedRequirements(graph)
       → computeBodyFields(graph)
       → filterParsedNodes(graph)          // when !parsedEnabled / --no-parsed
       → validateGraph(graph)
       → applyPriorityOverlay(graph, overlay?)   // Phase 4; slice ids only
       → buildDeliveryMapBundle(graph)
```

**`resolveProjectTitle`** (`packages/extension/src/host/resolveProjectTitle.ts`) —
extension-host only. For `adapter === 'github'`, delegates to `@verto/adapter-github`
`resolveProjectName`; other adapters return the adapter id until they supply their own
resolver. Keeps GitHub-specific I/O out of the generic load path.

**Required-field fallback policy (read path).** Some `VertoNode` properties are
required but may have no mapped ticket field. The mapper must behave consistently:

| Category | Verto properties | Behaviour when unmapped / invalid |
|---|---|---|
| **No fallback — fail** | `id`, `title`, `isDone`, `isDeliverySlice`, `ticketUrl`, `prereqIds`, `childIds`, `nodeType`, `nodeOrigin` | **Error; do not produce a graph.** System-mapped or stamped by `mapper.ts` (see system-only table above). If absent after mapping, data is corrupt. |
| **Valid neutral default — continue** | `priority` | **Use `5`**, continue. Audit flags missing mapping; emit non-fatal notice. |
| **Optional — continue** | `status` | **`undefined`** if no `fieldMappings` binding or board field absent (e.g. repository scope). No error. |
| **Optional — continue** | `personas` | **`[]`** if no `persona:<value>` labels (GitHub default path) and no `fieldMappings.personas` override. No error. Override: standard `fieldMappings` routing when `fieldMappings.personas` is set. |
| **Optional — continue** | `weight` | **`undefined`** if unmapped. Algorithms use `nodeWeight()` (see `completeness.ts`). No error. |
| **Optional — continue** | `created_at` | **System accessor** on GitHub (`issue.createdAt`); overridable via `fieldMappings.created_at`. No error if absent on other adapters. |
| **Enrichment-only** | `_rawReqIds` | **`[]`** on ticket nodes from adapter; populated by `materializeParsedRequirements`. Adapter does not set parsed-node entries. |

Parsed nodes (`nodeType: 'parsed'`) are created only by `@verto/text-parser`; they
are not subject to adapter fallback policy.

**`FieldWritePayload`** (used by `FieldAccessor.fromVertoNode`) is **to be defined
when write-back is designed** — not required for read-only MVP.

**Read path (adapter):**

```
Tracker → client.ts → tracker-native types → mapper.ts (+ FieldAccessors) → VertoGraph
```

**Read path (host — after adapter):**

```
VertoGraph → @verto/text-parser (materialize / filter) → validateGraph → buildDeliveryMapBundle → DeliveryMapBundle
```

**Write path (future):**

```
UI / core change → mapper.ts (reverse) → client.ts mutations → Tracker
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

**Interim tooling:** [`scripts/sync-github-project-fields.mjs`](./scripts/sync-github-project-fields.mjs)
prototypes aligning a GitHub ProjectV2 field *schema* with the VertoNode-derived
column set (Status options + custom fields). The extension's setup wizard will
reuse this discovery logic when seeding `verto.config.jsonc`.

#### 4.6.7 First adapter: GitHub Issues

Grounded in GitHub GraphQL capabilities documented under
[`graphql/`](./graphql/).

| Verto concept | GitHub home (decided) |
|---|---|
| **NCN edge** `A → B` (A prerequisite for B) | `addBlockedBy(issueId: B, blockingIssueId: A)`; read via `blockedBy` / `blocking` |
| **Parent/child** (child blocks parent) | Sub-issue relationship (`addSubIssue`, `parent` / `subIssues`); same graph semantics as blocking |
| **Done** (`isDone`) | Native GitHub issue `closed: boolean` — populated by system accessor; no `fieldMappings` entry needed by default. Drives `isReady` and `implementationOrder`. Overridable via `fieldMappings` if needed. |
| **Vertical designation** (`isDeliverySlice`) | System accessor default: `true` for top-level tickets (`parent` is null). Override via standard `fieldMappings` entry — e.g. `{ "from": { "kind": "issue", "field": "type" }, "values": { "Epic": true } }` |
| **Status** (`status`) | ProjectV2 built-in `Status` field — **canonical root** via `fieldMappings` (optional; `undefined` if unmapped) |
| **State reason** (`ticketFields.stateReason`) | Recommended passthrough in `defaults.verto.config.jsonc` — native GitHub issue field (`completed` / `not_planned` / `duplicate` / `reopened` / null); useful for display and filtering; `"type": "text"` |
| **Issue type** (`ticketFields.type`) | Native **org-level GitHub Issue Type** (defaults: Task, Bug, Feature; org may add e.g. Epic). **Not** duplicated as a project custom column |
| **Raw requirements** | Issue body `RAW_REQ:BEGIN` / `RAW_REQ:END` block; materialized by `@verto/text-parser` |
| **Personas** (`personas`) | **Default:** issue **labels** `persona:<value>` → `personas: string[]` (values after `persona:` prefix; label list order). **Override:** optional `fieldMappings.personas` in workspace config — when present, replaces label extraction (not in `defaults.verto.config.jsonc`). |
| **Labels** (`ticketFields.labels`) | Native issue labels — passthrough includes all labels; `persona:*` labels also feed canonical `personas` unless overridden |
| **AI SDLC metadata** (`ticketFields.*`) | ProjectV2 custom TEXT/NUMBER fields (`specified_by`, `planned_by`, …) — see recommended field names in `types.ts` `ticketFields` comment. Stored as comma-separated TEXT in GitHub — **values must not contain commas** (IDs, session IDs, model names are safe; arbitrary free text is not). Document this constraint at write time. |
| **Assignee, timestamps, body** (`ticketFields.*`) | Native issue / built-in ProjectV2 fields — non-canonical passthrough; `type` hints as appropriate |
| **Source URL** (`ticketUrl`) | Native issue `url` field — canonical root field; system-mapped (no `fieldMappings` entry needed) |
| **Priority** (`priority`) | Mapped via `fieldMappings` with `values` map when a source priority field exists. **If unmapped:** mapper uses **`5`** (neutral default) and continues; audit flags the gap. See required-field fallback policy (§4.6.5). |

**`github.scope` — project vs. repository (Phase 2 decision).** The GitHub adapter
supports two mutually exclusive modes, controlled by `github.scope` in `verto.config.jsonc`:

| `github.scope` | Issue enumeration | Board fields (`Status`, custom columns) |
|---|---|---|
| `"project"` | ProjectV2 API: `user\|organization(login).projectV2(number).items` | ProjectV2 API: per-item field values |
| `"repository"` | Issues API: `repository(owner, name).issues` with optional `issueFilter` | Not available — `kind: 'projectV2'` entries skipped with a warning |

**Issues-first API principle.** Regardless of scope, all issue-native fields (`id`,
`title`, `body`, `closed`, `url`, `stateReason`, issue type, labels, assignees, milestone,
`parent`, `subIssues`, `blockedBy`, `blocking`) are read via the **Issues GraphQL API**.
The ProjectV2 API is used only to (a) enumerate which issues belong to the project and
(b) read ProjectV2 board field values. This minimises ProjectV2 usage and keeps the
mapping layer consistent across scopes.

**`github.ownerType`.** Set to `"user"` (default) or `"organization"` to select between
`user(login).projectV2` and `organization(login).projectV2` for project-scope enumeration.

**Repository scope: issue filter.** Without narrowing, `repository.issues` returns every
open issue — unworkable for large repos. `github.issueFilter` (labels, states, milestone,
assignee) narrows the set. The audit script flags its absence as a warning.

**Graph closure for cross-scope references.** Blocking links (`blockedBy`), sub-issues
(`subIssues`), and external dependents (`blocking`) can reference issues outside the
configured project or filter set. After the initial fetch the adapter runs
`expandGraphClosure()` — a BFS fixed-point loop that collects all referenced issue node
IDs not yet in the graph, fetches them in batches (via the Issues API), and repeats until
closure is complete (capped at 5 rounds with a summary warning). Issues fetched during
closure have no ProjectV2 field values; `priority` defaults to `5` for them. If the cap is
reached with refs still unresolved, `validateGraph()` will surface the dangling refs as
errors. Note: `parent.id` is intentionally excluded from the closure referenced set —
under Verto semantics a child's `prereqIds` does **not** include its parent, so an
unloaded parent causes no dangling reference.

**Cross-link:** See [Phase 2 implementation plan](./IMPLEMENTATION.md#phase-2--github-adapter-read-only)
for the full deliverables, decisions, and verification steps.

**GitHub issue types (reference):** every org ships with **Task**, **Bug**, and
**Feature**; org owners may create up to **25** types total (rename/disable/delete
defaults allowed). Types are org-scoped and shared across repos.

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
5. **`runHostPipeline(graph, opts?)`** — `opts.parsedEnabled` (default `true`);
   `opts.priorityOverlay` (Phase 4, slice ids only): `materializeParsedRequirements`
   → `computeBodyFields` → `filterParsedNodes` when `parsedEnabled` is `false` →
   `validateGraph` → `applyPriorityOverlay` when overlay present →
   `buildDeliveryMapBundle`; returns `DeliveryMapBundle`. Shared by
   `scripts/load-project.mjs` and extension `loadPipeline.ts`.

**Body stripping (Phase 3, `panelManager.ts`):** After `runHostPipeline` returns the
bundle, `panelManager.ts` removes `ticketFields.body` from every node before sending
the `'update'` message to the webview. `_note` and `_outcome` are already on the node
root; the raw body is not needed by the webview and is stripped to reduce payload size.

**Orchestration** — single owner: **`runHostPipeline`** in `@verto/text-parser`
(§4.6.5). Adapters return **`VertoGraph` only**.

```
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
  vertical, current lens, graph pan/zoom, **custom journey priority overlay** (Phase 4,
  `workspaceState` until Phase 5 write-back), NCN highlight/focus and table-view
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
  auth, secrets, **host load pipeline** (`adapter.loadProject` → `@verto/text-parser`
  → filter → validate → optional **priority overlay** (Phase 4) →
  `buildDeliveryMapBundle` — §4.6.5, §4.6.8), **Enable Parsed
  Requirements** toggle persistence, and UI state. Adapters do **not** materialize
  parsed nodes or build bundles.
- **Webview responsibilities:** a view of the `DeliveryMapBundle`, config payload,
  and host-derived metadata (`projectName`, `priorityOptionHints`, overlay state).
  **Delivery Map** and **NCN graph** lenses with canvas-fidelity chrome (shared
  `components/ui.tsx`: pills, stats, data tables, status dots/legend). **Phase 4:**
  slice priority editor (dropdown), implementation-order / leverage table toggle,
  NCN pan/zoom/focus, status-group colouring on all nodes via `displayStatusGroup.ts`
  + `theme.ts`. The deprecated original canvas's `useCanvasState` is replaced by a
  thin hook over `postMessage` + host persistence. Theme via VS Code CSS variables
  instead of hard-coded hex.
- **Parity target:** Phase 4 **full UI fidelity** is **complete** — see
  [IMPLEMENTATION.md — Phase 4](./IMPLEMENTATION.md#phase-4--full-ui-fidelity).
  Phase 3 delivered the read-only foundation; Phase 4 matched canvas user-visible
  outcomes (priorities, tables, graph interaction, status colouring).

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
| `'update'` | `bundle: DeliveryMapBundle`; `displayStatusGroups: DisplayStatusGroup[]`; `parsedEnabled: boolean`; `priorityOverlayActive: boolean`; `projectName: string`; `journeyPriorityOverlay: Record<string, number>`; `priorityOptionHints: PriorityOptionHints`; `restoredState?: PersistedPanelState` | Initial load, refresh, parsed toggle, or priority overlay change |

*Webview → host:*

| Message `type` | Extra payload fields | Sent when |
|---|---|---|
| `'ready'` | — | Webview mounted; host holds the first `'update'` until this arrives |
| `'setParsedEnabled'` | `enabled: boolean` | User clicks the **Enable Parsed Requirements** toggle in the webview toolbar |
| `'setPriority'` | `sliceId: string; priority: number \| null` (`null` clears the override) | User edits priority on a delivery slice; host updates overlay + rebuilds bundle |
| `'persistState'` | `state: PersistedPanelState` | Lens switch, focused-node change, NCN highlight/focus, or table-view toggle (debounced) |

`displayStatusGroups` travels in `'update'` alongside the bundle — **not** inside
`DeliveryMapBundle` — keeping `@verto/core` free of config concerns.

**Adapter defaults programmatic export.** `configLoader.ts` imports adapter defaults
directly as a JS object rather than reading files at runtime (safe for the bundled
extension and for tests). Each adapter package therefore exports its defaults:
`@verto/adapter-github` exports `githubAdapterDefaults` from `src/index.ts`; esbuild
inlines it at build time. `defaults.verto.config.jsonc` remains the human-readable
source; the exported object mirrors it exactly.

### 4.9 Data source of truth vs declarative formats

**Tickets (via adapters) are the source of truth.** All delivery state — workflow status, done signal (`isDone`),
dependencies (including parent/child), vertical priority, narrative — lives in
the issue tracker (or file-based ticket store) and is loaded through adapters.

A **declarative bundle** (e.g. YAML/JSON) is **not** a parallel data model and
**not** something teams maintain by hand alongside tickets. If used at all, it is
only as:

- an **export/cache** snapshot produced by an adapter;
- a **validation artefact** in CI (schema + dangling-dependency checks); or
- the **on-disk format** for file-based adapters (e.g. Beans or Backlog.md).

**`verto.config.jsonc` is wiring, not backlog data.** It holds adapter selection and
**fieldMappings** (how tracker fields map to `VertoNode`) — not issue titles,
status values, or dependency graphs. Those live in tickets and are loaded on each
`loadProject()`.

The canonical schema governs what adapters **produce** for `@verto/core`; it is
not a separate user-editable project file in the ticket-first workflow.

### 4.10 Future extensibility

- Additional **adapters** (Jira, Beans or Backlog.md, others) behind the same interface.
- **Write-back** from the UI to the tracker (set status, add/remove blocking
  links, create child tickets when decomposing scope).
- Additional **lenses** (e.g. timeline, risk heatmap, sprint/board views) over
  the same core.
- **Multi-project** support via workspace config.
- A future **standalone web shell** reusing `@verto/core` for
  non-IDE/stakeholder viewing, without disturbing the extension.
- **CI validation** of adapter export snapshots against the canonical schema
  (dangling-dependency checks, etc.).

---

## 5. Knowledge Gaps

Resolved decisions are struck through; genuinely open items remain. Detail lives in
the body sections cited — this list is the index.

### 5.1 Domain model & ticket schema

- ~~**Final canonical schema.**~~ **Closed (Phase 2.5)** — core algorithm fields plus
  `status`, `nodeType`, `nodeOrigin`, `personas`, `created_at`, `weight`, `_rawReqIds` on `VertoNode`; `ticketUrl`
  **required** (`string`, not optional); see [`packages/core/src/types.ts`](./packages/core/src/types.ts).
  Ticket passthroughs via `fieldMappings` → `node.ticketFields` (**`status` is not** in
  `ticketFields` after Phase 2.5).
- ~~**VertoAdapter return type & orchestration.**~~ **Closed (Phase 2.5)** —
  `adapter.loadProject()` → `VertoGraph` only; `runHostPipeline(graph, opts?)` in
  `@verto/text-parser` owns materialize → filter → validate → bundle (§4.6.5, §4.6.8).
- ~~**Status vocabulary.**~~ **Closed** — workflow `status` on canonical root (from
  tracker); graph math uses `isDone`. Parsed raw lines use `raw` / `done`. Slice-level
  completeness shown via `deliveryCompleteness` Stat + completion-toned pills (Phase 4).
  Status/state-based node colouring on all nodes — `resolveDisplayStatusGroup()` +
  `theme.ts` palette by group index (Phase 4).
- ~~**Vertical priority representation.**~~ **Closed** — numeric field (1–9) required on all nodes; global ranking via chain-traversal algorithm with normalisation — see §3.5 and `types.ts` `Priority` type.
- ~~**Multi-parent scenarios.**~~ **Closed** — nodes with multiple upward chains each generate results per chain; the minimum normalised value wins — see §3.5.
- ~~**Black boxes.**~~ **Closed (removed)** — deprecated canvas section not ported;
  term not used in Verto; unchecked raw requirement status is **`raw`**.
- ~~**`VertoEdge.reason` vocabulary (known values).**~~ **Closed (Phase 2.5)** — closed
  union `'parent-child' | 'blocking' | 'parsed-req'` (no open `| string`); see
  `types.ts` and §4.6.8.
- ~~**`prereqIds` consistency validation.**~~ **Closed (Phase 2.5)** — after
  materialize/filter, assert `prereqIds` = `childIds ∪ _rawReqIds ∪ blocking` edge
  sources (§4.6.8 formula).
- ~~**`ticketUrl` validation severity.**~~ **Closed (Phase 2.5)** — missing `ticketUrl`
  on ticket nodes is a **validation error** (not a warning), aligned with §4.6.5.
- **Link metadata (other reasons).** Decomposition vs cross-cutting prerequisite
  labels for non–parent-child / non–blocking edges — still open (`VertoEdge.reason`
  beyond the three known values).
- **Additional fields.** Estimates, iterations/sprints — deferred; decide if/when they feed ordering.

### 5.2 Delivery Map presentation & decomposition

- ~~**Vertical designation (UI behaviour).**~~ **Closed (Phase 3)** — default:
  `isDeliverySlice = true` for top-level tickets (`parent` is null); override via
  `isDeliverySlice` fieldMappings (§4.6.4, §4.6.7). When no delivery slices are
  present: **empty screen** (auto-promote parents deferred).
- ~~**Delivery Map layout.**~~ **Closed (Phase 2.5 / Phase 3 UI)** — **single pipeline
  column** per slice: children first, then raw requirement lines; persona/outcome
  header; portfolio table, UsageBar, gap callouts — §3.7. No two-column layout.
- ~~**Raw requirements parsing.**~~ **Closed (Phase 2.5)** — `RAW_REQ:BEGIN` /
  `RAW_REQ:END` markers; materialize as `nodeType: 'parsed'` via `@verto/text-parser`;
  name/note patterns, synthetic ids, NCN participation when toggle on — §3.6–§3.8,
  §4.6.8.
- ~~**Enable Parsed Requirements toggle.**~~ **Closed (Phase 2.5)** — global,
  default on, `workspaceState`; filter graph when off — §3.7, §4.6.8.
- ~~**Portfolio columns / UsageBar / gaps.**~~ **Closed (Phase 2.5; renamed)** —
  `ui.displayStatusGroups` — §4.6.3.
- ~~**Portfolio column matching algorithm.**~~ **Closed (Phase 2.5)** — first matching
  group in config order; per-source OR between `isDone` predicate and `statuses`
  list; non-done groups require `!isDone`; satisfied groups structural (`isDoneBucket`) —
  §4.6.3.
- ~~**DESC blocks (outcome & child notes).**~~ **Closed (Phase 2.5)** —
  `computeBodyFields` in `@verto/text-parser` sets `_outcome` (first DESC paragraph) on
  ticket nodes at pipeline time; `_note` on children likewise. `ticketFields.body`
  stripped by `panelManager.ts` before webview `'update'` message (§3.7, §4.6.8).
- ~~**UI port fidelity (Delivery Map).**~~ **Closed (Phase 3–4)** — persona/outcome,
  pipeline, portfolio table (incl. Primary user column), UsageBar, gaps; completion-toned
  slice pills and shared table chrome (Phase 4); deprecated black-box section **not** ported.
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

- ~~**Adapter package architecture.**~~ **Closed** — canonical vs tracker-native
  types, package layout (`system_types`, `project_fields` registry, `client`, `mapper`,
  `adapter`), `FieldAccessor` contract, `CANONICAL_VERTO_NODE_KEYS` routing
  (canonical → node root; non-canonical → `node.ticketFields`), and read/write
  pipeline — see §4.6.1–§4.6.5.
- ~~**Configuration model.**~~ **Closed** — `defaults.verto.config.jsonc` per adapter,
  `.vscode/verto.config.jsonc` workspace overrides, `fieldMappings` (field + value),
  **field-level** merge granularity for `fieldMappings` (workspace entry replaces
  whole default entry; value-level merge deferred), names-only user-facing config,
  runtime ID cache with name fallback, workspace-wins merge — see §4.6.3–§4.6.4.
- ~~**GitHub field conventions (Verto workspace).**~~ **Closed (updated Phase 2.5)** —
  `isDone` from native `closed` boolean; `isDeliverySlice` from `parent === null` by
  default (overridable); `status` canonical via ProjectV2 `Status` `fieldMappings`
  (optional); `priority` + AI SDLC on ProjectV2 custom columns; `stateReason` passthrough;
  issue type via org-level Issue Type; **`personas` default from issue labels
  `persona:<value>`** (no default `fieldMappings.personas`); optional
  `fieldMappings.personas` override — §4.6.7. Field-schema sync:
  [`scripts/sync-github-project-fields.mjs`](./scripts/sync-github-project-fields.mjs).
- ~~**Personas source (GitHub).**~~ **Closed (Phase 2.5)** — label prefix `persona:`;
  optional `fieldMappings.personas` replaces label extraction — §4.6.4, §4.6.7.
- ~~**Config bootstrap / audit.**~~ **Closed (design + library)** — audit step drafts
  `verto.config.jsonc` from live project shape; `auditProjectScope` /
  `auditRepositoryScope` exported from `@verto/adapter-github` (Phase 4); extension setup
  wizard (screens / validation UX) still open — see §4.6.6.
- ~~**Required-field fallback (read path).**~~ **Closed (Phase 2.5)** — fail:
  `id`, `title`, `isDone`, `isDeliverySlice`, `ticketUrl`, `prereqIds`, `childIds`,
  `nodeType`, `nodeOrigin`; default `5`: `priority`; optional: `status` (`undefined`),
  `personas` (`[]` or label extraction); enrichment: `_rawReqIds` (`[]` from adapter) —
  see §4.6.5. `nodeType` / `nodeOrigin` stamped by `mapper.ts`.
- ~~**`VertoConfig` schema.**~~ **Closed (Phase 2; extended Phase 4)** — `fieldMappings`
  is `Record<string, FieldMappingEntry>` nested under `github` in `VertoConfig` when the
  GitHub adapter is selected; `github` is **optional** on `VertoConfig` at the type level
  and required by JSON Schema only when `adapter === "github"`; `from.kind: 'issue' |
  'projectV2'`; optional `values` map (full-entry replace on merge); optional `type`
  hint; `scope`-conditional required fields inside `github`; JSONC via `comment-json` —
  see `packages/config/` (`@verto/config`).
- ~~**Read-only MVP vs. write-back day one.**~~ **Closed** — read-only MVP first
  (Phases 2–4); write-back in Phase 5.
- ~~**GitHub adapter scope.**~~ **Closed (Phase 2)** — `github.scope: "project" |
  "repository"`; Issues-first API; `github.ownerType: "user" | "organization"`;
  `expandGraphClosure()` for cross-scope refs — see §4.6.7.
- **Write-back conflict policy.** Concurrency/merge rules when the UI and the
  tracker disagree.
- **GitHub operational details.** ID cache: in-memory only for Phase 2 (workspace-
  persisted deferred to Phase 5). Rate-limit: exponential backoff (100 ms × 2ⁿ, max 3
  retries). Pagination: cursor-based, fetch all pages (top-level + nested connections).
- **Adapter capability differences.** How the core/UI degrade gracefully when an
  adapter lacks a feature (e.g. no custom fields, no native blocking links). Partially
  addressed: `resolveProjectTitle` falls back to adapter id; `requireGitHubConfig` gives
  a specific error when `github` is missing for the GitHub adapter.
- **Beans or Backlog.md / file-system shape.** File format, on-disk schema, and how
  dependencies/priorities are expressed in files; equivalent of `project_fields.ts`
  for config-driven fields if needed.

### 5.4 Extension & UI

- ~~**UI port fidelity (Phase 3 scope).**~~ **Closed** — Delivery Map and NCN lenses
  achieve canvas fidelity (Phase 3 foundation + Phase 4 interaction/colouring/tables).
- ~~**DAG layout library.**~~ **Closed (Phase 3)** — **@xyflow/react** (React
  Flow) for graph UI; **ELK** (`elkjs`) for layout. See §4.8.
- ~~**Extension bundlers.**~~ **Closed (Phase 3)** — host: **esbuild**; webview:
  **Vite** (§4.8).
- ~~**NCN pan/zoom (Phase 3).**~~ **Closed (Phase 4)** — enabled in `NcnGraph.tsx`.
- ~~**Theming.**~~ **Closed (Phase 4)** — Status-based colouring uses VS Code theme
  variables throughout. Palette mapped by display-status-group **array position** in
  `theme.ts` (not user-configurable; no config changes). `pillToneForNode()` maps group
  index to pill tones in tables. See §4.6.3.
- **Large-graph performance.** Deferred — evaluate after Phase 4 when the
  interactive graph can be dogfooded (see IMPLEMENTATION.md unplanned backlog).
- ~~**Where the panel lives.**~~ **Closed (Phase 3)** — **editor tab**
  (`WebviewPanel`). Agent/chat workflow integration — deferred.
- ~~**Setup UX (adapter config).**~~ **Partially closed** — audit library shipped
  (`@verto/adapter-github`); wizard asks adapter + project identity, runs audit, seeds
  `.vscode/verto.config.jsonc` from `defaults.verto.config.jsonc` + discovered project
  shape — see §4.6.3, §4.6.6. **Remaining:** exact wizard screens and validation UX.

### 5.5 Product & process

- ~~**Extension identifiers.**~~ **Closed (Phase 3)** — product name **Verto**;
  extension display name **Verto**; core package **`@verto/core`** (monorepo
  `workspace:*`, no npm publish); first shell **Verto for VS Code**; extension id
  **`manmilani.verto`**; marketplace publisher **`manmilani`**.
- ~~**Distribution.**~~ **Closed (Phase 3)** — **private `.vsix`** only (not
  Marketplace).
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
| 5 | Write-back |
| 6 | Beans (file-system) adapter |
