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
4. [Solution System Design](#4-solution-system-design)
5. [Knowledge Gaps](#5-knowledge-gaps)

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
  On top of the graph the view computes readiness, transitive **downstream
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
of truth for the schema, the algorithms, or the UI of the system described in the
rest of this document, and **will eventually be deleted**.

### 1.6 How to read `deprecated_original_canvas/` (during early migration only)

The deprecated original canvas is **not** a specification. While building the
first Verto extension, you may consult it to understand proven **concepts and UI
behaviour** — not Rustybu domain content or the target data shape. Do not treat
it as a living reference beyond that migration phase.

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
journey are equivalent semantic labels on certain nodes; and body task lists are
documentation only (Delivery Map shows body + children — see §3.6–§3.7).

**GitHub adapter reference:** [graphql/github-issues.md](./graphql/github-issues.md)

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
- **Status** = a small, ordered vocabulary of progress (the canvas used
  `done` / `partial` / `designed` / `missing`; the production vocabulary is to be
  finalised — see Knowledge Gaps).

Modelling shared enablers as a *single* node that many delivery subgraphs depend
on is what makes **leverage** visible: a missing foundational node may block many
nodes (and many verticals) at once.

### 3.3 NCN — Necessary Conditions Network

The graph is a **Necessary Conditions Network**: edges encode *necessity*, not
mere sequence preference. From this structure we derive, for **any node** (the
algorithms are node-agnostic):

- **Closure** — the complete transitive set of prerequisites required to
  deliver a node (that node plus everything it depends on).
- **Readiness** — a node is *ready* when it is not yet done and **all** of its
  direct prerequisites are done. Ready nodes are where work can actually start.
- **Downstream leverage** — how many nodes ultimately depend on a given node.
  High-leverage nodes are the ones whose completion unblocks the most.
- **Delivery completeness** — for any focused node, how much of its delivery
  subgraph (closure) is already done, i.e. how close that node is to deliverable.

### 3.4 TOC — Theory of Constraints as the sequencing philosophy

NCN tells us *what depends on what*; **TOC** tells us *what to do about it*. We
treat delivery as a flow limited by constraints and sequence work to **exploit
the constraint and unblock value fastest**, rather than spreading effort evenly.
Concretely, the abstract policy is:

- Identify what currently constrains the delivery of the prioritised value
  (the missing prerequisites in a prioritised node's closure).
- Prefer work that **relieves those constraints** and unblocks the most
  downstream value (leverage), subject to dependency order.
- Avoid investing in items that do not move a prioritised node closer to
  deliverable.

This is the conceptual basis for the "what to build next / in what order"
behaviour; the precise algorithm lives in the system-design section.

### 3.5 Prioritisation model

Priority is expressed as the manager's intent on **which nodes matter most** —
in practice, almost always the **vertical/epic nodes** (market demand, customer
value). The mechanism is node-generic: prioritising **any** node N lifts *every*
node in N's delivery subgraph. That high-level intent **propagates through the
graph**:

- **Priority inheritance / lifting.** Prioritising a node lifts *every* node in
  its delivery subgraph (closure). A node inherits the best (highest) priority of
  any prioritised node whose closure contains it.
- **From intent to an executable order.** Combining (a) inherited priority, (b)
  dependency order (prerequisites before dependents), and (c) downstream leverage
  as a tie-breaker yields a single, concrete **implementation order** — a
  priority-weighted topological sort of the not-yet-done work in the prioritised
  nodes' closures. Following it top-to-bottom delivers the prioritised nodes as
  fast as the dependencies allow.
- **Default behaviour without explicit priorities.** With no priorities set, the
  system can still recommend by pure leverage: the ready items that unblock the
  most.

### 3.6 Ticket body documentation vs graph nodes

A deliberate distinction (and a correction of the canvas's conflation):

- **Graph nodes** = all tracked tickets. Same structure and behaviour throughout.
  They participate in closure, readiness, leverage, and ordering.
- **Body documentation** — including markdown task lists (`- [ ]` / `- [x]`) in
  the body of **any** ticket — is free-form prose for describing what needs to
  be delivered. It is **documentation only**. The graph and all core algorithms
  **do not parse, depend on, or care about** task lists or other body content.

When scope becomes clearer, work is **decomposed into child tickets** that
implement the parent — not by "promoting" checklist items into the graph, but by
creating real tracked children. A parent may or may not retain a task list in its
body; either way, only child tickets (and other dependency links) matter to the
graph.

### 3.7 Delivery Map lens (vertical-focused presentation)

The Delivery Map is a **presentation lens**, not a separate data model. It
emphasises nodes designated as verticals (vertical delivery / vertical slice /
user journey / epic — equivalent terms; materialised as a top node, probably
Epic ticket type).

For each vertical node, the Delivery Map shows **two complementary views**
side by side:

1. **Body documentation** — the ticket description and any markdown task lists in
   the body. These help envision and communicate what the vertical should achieve
   (e.g. imagining what a user would need to be able to do). They are
   **documentation only**; the graph does not parse or depend on them. An epic
   may or may not include such a list.
2. **Child tickets** — the node's children (if any), i.e. the decomposed work
   that implements the epic. These **are** graph nodes and drive readiness,
   delivery completeness, leverage, and ordering.

The deprecated original canvas showed a single hard-coded `steps[]` list per journey with
status values; the target system replaces that with this dual presentation. As
scope becomes clear, work is broken down into child tickets — with or without a
task list remaining in the epic body.

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
+------------------------------------------------------------------+
|              Verto for VS Code / Cursor (extension)              |
|                                                                  |
|  +---------------------------+      +-------------------------+  |
|  |  Extension Host (Node)    |      |   Webview (React UI)    |  |
|  |                           |      |                         |  |
|  |  - Adapter registry       | <==> |  - Delivery map lens    |  |
|  |  - Active adapter (GH/...) | post |  - NCN graph lens       |  |
|  |  - Ticket body parser     | msg  |  - Priorities + order   |  |
  |    (display-only)         |      |                         |  |
|  |  - Workspace/global state |      |  - (dumb view of bundle)|  |
|  |  - Auth (e.g. GH provider)|      +-------------------------+  |
|  +-------------+-------------+                                   |
|                |                                                 |
+----------------|-------------------------------------------------+
                 |
        +--------+---------+----------------+
        |                  |                |
   GitHub Issues      Jira (later)    File-system (later,
   (first adapter)                     e.g. Backlog.md)
                                                |
                       (shared, reused by all shells)
                +---------------------------------------+
                |        @verto/core (library)          |
                |   - Canonical domain types/schema     |
                |   - Validation (dangling deps, etc.)  |
                |   - closure / readiness / leverage    |
                |   - priority lifting + exec ordering  |
                |   - DAG layout                        |
                +---------------------------------------+
```

### 4.3 The shared core (`@verto/core`)

Host- and vendor-agnostic. Responsibilities:

- **Canonical domain model** (the schema below) and its TypeScript types.
- **Validation:** dangling dependency references, cycles, illegal status values,
  invalid vertical designations, etc.
- **Pure algorithms**, initially ported from the deprecated original canvas so they
  depend only on the canonical model: `closureFor` (any node), `isReady`,
  downstream-leverage, delivery completeness, priority lifting, and the
  priority-weighted topological **implementation order**. Graph layout (DAG
  positioning) is either vendored from the deprecated original `computeDAGLayout`
  logic or reimplemented on a standard lib.
- **No I/O, no host APIs, no UI.** Everything network/disk/host lives behind the
  adapter interface and the extension host.

### 4.4 Canonical domain model (design in progress)

> The **canonical schema will be fully specified by the system designer**; it is
> **not yet complete**. Richer fields are planned beyond what is listed here.
> The table below is an **indicative starting vocabulary** carried over from the
> deprecated original canvas. It is **not** the final schema. End users of the
> extension do not define the schema.

| Concept | Legacy canvas (deprecated original) | Meaning (target system) | Likely ticket home (per adapter) |
|---|---|---|---|
| Graph node | `node.id` | Any tracked ticket — uniform structure (~95% identical across all nodes) | Issue / sub-issue |
| Node identity | `node.id` | Stable identifier | Issue key / stable slug |
| Title / description | `label`, `desc` | Human name + detail (body may include task lists) | Issue title + body |
| Delivery status | `status` (4-valued) | Progress state | Label or single-select custom field |
| Necessary-condition edge | `deps[]` | Prerequisite nodes (unified) | "blocked by" / "blocks" link **or** parent/child link |
| Parent/child link | *(not in deprecated original)* | Same as NCN edge: child blocks parent | Sub-issue / parent issue relationship |
| Vertical designation | journey `id` / name | Semantic role: deployable, value-adding slice (same as epic / journey) | Epic issue type, label, or field |
| Vertical narrative | `persona`, `outcome` | Why the slice matters | Body template sections on vertical nodes |
| Body task lists | journey `steps[]` *(deprecated original)* | Documentation only — **ignored by graph** | Markdown `- [ ]` in **any** ticket body |
| Black box | `BLACK_BOXES` | Absent system blocking many verticals | Tagged epic / meta issue |
| Vertical priority | `journeyPriorities` | Manager's ranking of verticals | **Ticket field(s)** on vertical nodes |
| Vertical membership *(deprecated original only)* | `verts[]` | Legacy canvas field — **not** used in target system | Replaced by parent/child + unified deps |
| Journey steps with status *(deprecated original only)* | `steps[]` with `status` | Legacy canvas — **not** used in target system | Replaced by child tickets + body docs in Delivery Map |

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
- **Body task lists** in any ticket are documentation for humans; only child
  tickets and other dependency links affect the graph.
- **Priority** is a property of vertical-designated nodes (ideally a ticket
  field), from which per-node inherited priority and the global implementation
  order are derived.

### 4.5 Tickets in the tracker

The agreed mapping that resolves the canvas's conflation:

- **Every ticket = one graph node**, with uniform structure and behaviour.
- **Vertical** (vertical delivery / vertical slice / user journey / epic) =
  the **same concept**, materialised as a top node (probably Epic ticket type)
  carrying narrative (`persona`, `outcome`) in a templated body where needed.
- **Body documentation** — description and optional markdown task lists in the
  body of **any** ticket — is for human communication only. Parsed optionally
  for **Delivery Map display**; never fed to NCN/leverage/order math.
- **Child tickets** decompose a parent into implementable work. Parent/child
  and BlockedBy/Blocking both express necessary-condition edges (child blocks
  parent). Any ticket may have children, not only epics.
- **Delivery Map** (see §3.7) shows body documentation and child tickets **side
  by side** for each vertical node.

### 4.6 Multi-adapter support

- **Adapter interface (conceptual):** `loadProject(config) → DeliveryMapBundle`
  (+ optional raw metadata), with optional `saveSession?` / `writeBack?`
  capabilities added incrementally. Each adapter implements a **field-mapping
  profile** translating vendor fields ↔ the canonical model — not a one-off hack.
- **First adapter: GitHub Issues.** Grounded in the GitHub GraphQL capabilities
  documented in [graphql/github-issues.md](./graphql/github-issues.md):
  - NCN edge `A → B` (A is prerequisite for B) ⇒ `addBlockedBy(issueId: B,
    blockingIssueId: A)` (B is blocked by A); read via `blockedBy` / `blocking`.
  - Parent/child ⇒ sub-issue relationship (`addSubIssue`, `parent` / `subIssues`);
    treated identically to blocking links for graph math (child blocks parent).
  - Status ⇒ labels (`status:done`, …) or a repo **single-select custom field**.
  - Vertical designation ⇒ epic issue type, label, or field.
  - Body documentation ⇒ issue title + body (optional task-list parse for
    Delivery Map display only).
  - Vertical priority ⇒ a custom field on epics (or a ProjectV2 field/ordering).
- **Later adapters:** Jira; local file-system trackers such as **Backlog.md**.
  All implement the same interface and are selected/configured at workspace setup.
- **Selection & configuration:** the adapter is chosen and configured when the
  extension is first set up in a workspace (a setup wizard and/or a
  `verto.config.*` file under `.vscode`/workspace).

### 4.7 State: tickets vs. workspace

- **In tickets (shared, versioned with the backlog):** status, dependency links
  (parent/child and BlockedBy/Blocking), body content (including any task lists),
  vertical narrative, and — as much as possible — **vertical priority**. Rule of
  thumb: *if a teammate should see it without opening your IDE, it's in the
  ticket.*
- **In workspace/global state (local wiring & preferences):** which adapter,
  repo/project identifiers, field-ID mapping overrides, refresh interval,
  conventions (e.g. which label marks an epic as a vertical), and transient view
  state (selected vertical, current lens, graph pan/zoom). Rule of thumb: *if it's
  "how this repo is wired to the extension," it's workspace config.*

### 4.8 Verto for VS Code (extension shell)

- **Product name:** Verto. **Extension display name:** Verto (or *Verto for VS
  Code*). Extension identifier (e.g. `verto.verto`) and marketplace publisher —
  to be finalised (see §5.5).
- **Standard pieces only:** extension manifest + activation, a **Webview** (or
  Custom Editor) hosting a bundled React app, `postMessage` for host↔webview
  communication, `workspaceState`/`globalState` for persistence, the built-in
  **GitHub authentication provider** for the GitHub adapter, and a standard
  bundler (esbuild/Vite). CSP-safe bundle; no inline scripts.
- **Host responsibilities:** all I/O (adapter calls, GitHub GraphQL, file reads),
  auth, secrets, optional ticket-body parsing (display-only, for Delivery Map),
  and state persistence.
- **Webview responsibilities:** purely a view of the `DeliveryMapBundle` it
  receives — the two lenses, the priorities editor, and the implementation-order
  table. The deprecated original canvas's `useCanvasState` is replaced by a thin hook
  over `postMessage` + host persistence (the React-facing API can stay nearly
  identical). Theme via VS Code CSS variables instead of hard-coded hex.
- **Parity target:** the NCN graph lens, custom vertical priorities, and the
  implementation-order table behave **the same** as the deprecated original canvas
  (same core algorithms). The Delivery Map lens keeps the vertical-focused presentation but
  replaces hard-coded `steps[]` with **body documentation + child tickets** side
  by side (see §3.7).

### 4.9 Data source of truth vs declarative formats

**Tickets (via adapters) are the source of truth.** All delivery state — status,
dependencies (including parent/child), vertical priority, narrative — lives in
the issue tracker (or file-based ticket store) and is loaded through adapters.

A **declarative bundle** (e.g. YAML/JSON) is **not** a parallel data model and
**not** something teams maintain by hand alongside tickets. If used at all, it is
only as:

- an **export/cache** snapshot produced by an adapter;
- a **validation artefact** in CI (schema + dangling-dependency checks); or
- the **on-disk format** for file-based adapters (e.g. Backlog.md).

The canonical schema governs what adapters produce; it is not a separate
user-editable project file in the ticket-first workflow.

### 4.10 Future extensibility

- Additional **adapters** (Jira, Backlog.md, others) behind the same interface.
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

All open questions, ambiguities, and not-yet-decided items live here.

### 5.1 Domain model & ticket schema (design in progress)

- **Final canonical schema.** Exact field names, types, and the full set of
  fields beyond the indicative vocabulary in §4.4 (more fields and functionality
  are planned — to be enumerated and designed by the system designer).
- **Status vocabulary.** Keep the canvas's four values (`done`/`partial`/
  `designed`/`missing`) or redefine? How is each mapped/derived per adapter, and
  is "partial" a single state or a percentage?
- **Vertical priority representation.** One global ordered list vs. a per-epic
  numeric/select field vs. ProjectV2 ordering — and how that is stored *in
  tickets* across adapters with differing capabilities.
- **Link metadata.** Parent/child and BlockedBy/Blocking are unified for graph
  math (**decided** — see §3.1). How is the *reason* for a link recorded as
  metadata (e.g. decomposition vs cross-cutting prerequisite)?
- **Multi-parent scenarios.** A ticket blocking multiple epics, or shared
  dependencies across vertical slices — edge cases in closure and priority
  inheritance.
- **Black boxes.** First-class entity, a flavour of work-item/epic, or a derived
  view? How represented in tickets.
- **Additional fields.** Owners, estimates, iterations/sprints, risk, value/size,
  tags — which are in scope, and do any feed priority or ordering?

### 5.2 Delivery Map presentation & decomposition

- **Vertical designation.** How does the system identify which nodes are
  verticals for the Delivery Map lens? (epic issue type, label, custom field, …)
- **Delivery Map layout.** Exact presentation of body documentation vs child
  tickets side by side — ordering, grouping, status display, empty states (epic
  with body but no children yet).
- **Body parsing conventions.** Optional rules for extracting task lists from
  ticket bodies for display-only rendering (any ticket, not only epics).
- **Decomposition workflow.** How child tickets are created when breaking down a
  parent (manual command, template, UI action, auto-link back to parent).
- **The ~5% node differences.** What fields or behaviours differ between nodes
  if ~95% are structurally identical? (e.g. vertical designation, priority field,
  narrative template sections.)

### 5.3 Adapters & data

- **Read-only MVP vs. write-back day one.** Likely read-only first, but confirm.
- **Write-back conflict policy.** Concurrency/merge rules when the UI and the
  tracker disagree.
- **GitHub specifics.** Exact label/field/issue-type conventions; rate-limit and
  caching strategy; GraphQL node-ID resolution flow; how "epic" is recognised.
- **Adapter capability differences.** How the core/UI degrade gracefully when an
  adapter lacks a feature (e.g. no custom fields, no native blocking links).
- **Backlog.md / file-system shape.** File format, on-disk schema, and how
  dependencies/priorities are expressed in files.

### 5.4 Extension & UI

- **UI port fidelity.** How faithfully to reproduce the canvas's graph SVG,
  focus mode, pan/zoom, and tables; which `cursor/canvas` primitives need
  replacing (`Table`, `UsageBar`, `Pill`, DAG layout, …).
- **DAG layout library.** Vendor the existing `computeDAGLayout` logic or adopt a
  standard (dagre/elk)?
- **Theming.** Mapping the status palette onto VS Code theme variables.
- **Large-graph performance.** Behaviour and possible simplification for big node
  counts.
- **Where the panel lives.** Editor tab vs. sidebar vs. custom editor; and how
  (if at all) it integrates with agent/chat workflows.
- **Setup UX.** Wizard vs. config file vs. both for first-run adapter selection.

### 5.5 Product & process

- **Extension identifiers.** VS Code extension id (e.g. `verto.verto`), marketplace
  publisher name, and npm scope availability for `@verto/core`. **Decided:** product
  name **Verto**; core package **`@verto/core`**; first shell **Verto for VS Code**.
- **Distribution.** Marketplace vs. private VSIX vs. monorepo packaging.
- **Repository strategy.** Where the core + extension live relative to consuming
  projects (monorepo vs. standalone repo).
- **Team vs. personal state.** Whether priorities/views are per-user, per-team,
  or committed for shared alignment — reconciled with "priority in tickets."
- **Multi-project / multi-repo** scope and timing.
- **Definition of "delivered" for a vertical** and any metrics for the success
  criteria in §2.4.
