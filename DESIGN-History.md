# Verto — Design History

> Retired designs, considered-and-rejected options, the project's origin and resolved
> knowledge gaps. **Not** the current design — see [DESIGN.md](./DESIGN.md) for that.
> Section references (`§x.y`) without a file name point to DESIGN.md.

---

## Contents

1. [Origin — the Rustybu canvas](#1-origin--the-rustybu-canvas)
2. [Legacy canvas → Verto concept mapping](#2-legacy-canvas--verto-concept-mapping)
3. [Retired: Beans / Backlog.md file-system adapter](#3-retired-beans--backlogmd-file-system-adapter)
4. [GitHub `fieldMappings`: superseded and rejected options](#4-github-fieldmappings-superseded-and-rejected-options)
5. [Removed concepts and config migrations](#5-removed-concepts-and-config-migrations)
6. [Resolved knowledge gaps](#6-resolved-knowledge-gaps)

---

## 1. Origin — the Rustybu canvas

*Formerly DESIGN.md §1 "Background — the existing Rustybu canvas". Phase 4 (full UI
fidelity) is complete, so the canvas is no longer a behavioural reference.*

### 1.1 What it is

The starting point for this whole idea is a single Cursor **canvas** file,
[`deprecated_original_canvas/rustybu-vertical-delivery-map.canvas.tsx`](./deprecated_original_canvas/rustybu-vertical-delivery-map.canvas.tsx)
(~1,800 lines), preserved verbatim in `deprecated_original_canvas/` (with its
`.data.json` session state and `.status.json` build artifact). A Cursor canvas is a
self-contained React component compiled by the IDE and shown beside the chat; it may
only import from `cursor/canvas`, cannot do any network/`fetch`, and embeds **all of
its data inline**.

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

### 1.3 How it worked (and why that's "bespoke")

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

### 1.5 Role during migration (Phases 0–4)

**Deprecated — initial migration aid only.** The copy in
`deprecated_original_canvas/` explained how we arrived here and helped when porting
concepts and UI behaviour into Verto. It was never the source of truth for the
canonical schema, algorithms, or data model, and will eventually be deleted.

**Exception — Phase 4 UI outcomes.** For Phase 4 "Full UI fidelity", the canvas was
the authoritative **behavioural** reference for what the user experiences
(interaction flows, layout, tables, focus/highlight behaviour) — not for its
implementation (code structure, state mechanisms, inline data, Rustybu domain
content). See [IMPLEMENTATION.md — Phase 4](./IMPLEMENTATION.md#phase-4--full-ui-fidelity).

**How it was read.** For structure and behaviour: the data shapes `JOURNEYS`,
`NODES`, `BLACK_BOXES`, `STATUS`; `MapView`; `GraphView`, `closureFor`, `isReady`,
`buildExecutionOrder`; the session-state example
[`rustybu-vertical-delivery-map.canvas.data.json`](./deprecated_original_canvas/rustybu-vertical-delivery-map.canvas.data.json);
optional evolution context in
[`chat_summary_1__060d34f9.md`](./deprecated_original_canvas/chat_summary_1__060d34f9.md)
(canvas authoring) and
[`chat_summary_2__e4e7087f.md`](./deprecated_original_canvas/chat_summary_2__e4e7087f.md)
(Verto system design). Ignored: Rustybu-specific journey names, step notes and
black-box prose; inline data as something to reproduce.

**Canvas model vs Verto model.** The canvas used a separate `verts[]` field on nodes
to associate work-items with journeys, and hard-coded `steps[]` with status per
journey. In Verto all tickets are equal graph nodes; parent/child and
BlockedBy/Blocking are unified dependency links; vertical/epic/journey are equivalent
semantic labels on certain nodes; and raw requirements plus child tickets form the
unified Requirement list in the Delivery Map (§3.6–§3.8). Verto's Delivery Map
pipeline (children, then raw requirement lines, in one column) is the successor of
the canvas `steps[]`; slice pills follow the canvas pattern.

---

## 2. Legacy canvas → Verto concept mapping

*Formerly in DESIGN.md §4.4, retained for cross-referencing legacy canvas concepts.*

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

---

## 3. Retired: Beans / Backlog.md file-system adapter

*Retired October 2026; replaced by the [fissue](https://github.com/manmilani/fissue)
adapter (§4.6.10).*

**What was planned.** Phase 6 was a second adapter for local, Beans-format ticket
stores (`packages/adapters/beans/`: `system_types.ts`, `client.ts`, `mapper.ts`,
`adapter.ts`, `defaults.verto.config.jsonc`), so Verto could load its own development
backlog (`backlog/`) with itself. `client.ts` would read files directly or optionally
use Beans' GraphQL API (reference: `graphql/hmans_beans_graphql.agent_prompt.md` and
`graphql/graphql_schema_files/hmans-beans.schema.graphqls`, both now deleted). The
on-disk format (planned `backlog/tasks/*.md` frontmatter and `.beans.yml`) and
dependency/priority conventions were an open knowledge gap. Backlog.md was listed as
an equivalent alternative.

**Why retired.** Neither tool matches what Verto needs: GitHub-parity native fields
and relationships, user-defined fields added without code changes, and a format
designed alongside Verto's `fieldMappings`. Forking either was rejected in favour of a
purpose-built tool.

**Also rejected while designing the replacement** (detail in
[fissue's DESIGN-History.md](https://github.com/manmilani/fissue/blob/main/DESIGN-History.md)):
building the tracker inside Verto (as a package or under `.verto/tickets/`); a git
submodule; a hard `extensionDependencies` link between the two extensions.

---

## 4. GitHub `fieldMappings`: superseded and rejected options

*Decided October 2026 in [verto#9](https://github.com/manmilani/verto/issues/9); the
current design is in §4.6.4 and §4.6.7.*

- **Superseded — two kinds with an implicit allow-list.** `from.kind` accepted only
  `"issue"` and `"projectV2"`. For `"issue"`, only names known to
  `ISSUE_FIELD_RESOLVER` and selected in the fixed `ISSUE_FIELDS` query were read; any
  other name silently resolved to `null` (priority then fell back to 5). "Field
  doesn't exist" and "field is empty" were indistinguishable, and `issueFieldValues`,
  `duplicateOf` and relates-to were never fetched.
- **Rejected — org issue fields under `"issue"`.** One kind for built-in properties
  and org issue fields would need collision rules between the two namespaces. A
  separate `"issueField"` kind avoids them.
- **Rejected — naming the built-in kind `"builtIn"`.** GitHub also calls Project
  fields such as Title and Assignees "built-in fields", so the name would be
  ambiguous. `"issue"` (the GraphQL `Issue` type) is kept.
- **Rejected — validating per issue or against a hard-coded list.** Fields are checked
  once per load by trying them against GitHub (trust the config).
- **Not adopted (for now) — introspecting `Issue` to flatten any property.** A
  one-time schema introspection could give existence, types and a generic flattening
  for object/connection properties. Rejected as more machinery than needed: unknown
  names are tried as scalars, and non-scalar ones are reported as unsupported until
  they get a resolver entry.

---

## 5. Removed concepts and config migrations

- **Black boxes.** The canvas's "The biggest black boxes" section (absent systems
  blocking many journeys) was not ported. The term is not used in Verto; an unchecked
  raw requirement has status **`raw`**, replacing the canvas's "missing" / "black
  box" status.
- **`portfolioColumns` → `ui.displayStatusGroups`** (Phase 2.5 rename).
- **Legacy Done display group.** Configs that listed a **Done** display group and/or
  `isDone` predicates on group rules now **fail validation** at parse time. Migration:
  remove the **Done** entry; map completion via native `issue.closed` (default) or
  `fieldMappings.isDone`. User groups list only open workflow **`statuses`** per
  source type (§4.6.3).
- **`DisplayStatusGroup` presentation fields.** `tone`, `chartColor` and `weight` were
  dropped; colouring is by group index (§4.6.3).

---

## 6. Resolved knowledge gaps

*Formerly the struck-through items of DESIGN.md §5. Open items remain there.*

### 6.1 Domain model & ticket schema

- **Final canonical schema.** Closed (Phase 2.5) — core algorithm fields plus
  `status`, `nodeType`, `nodeOrigin`, `personas`, `created_at`, `weight`, `_rawReqIds` on `VertoNode`; `ticketUrl`
  **required** (`string`, not optional); see [`packages/core/src/types.ts`](./packages/core/src/types.ts).
  Ticket passthroughs via `fieldMappings` → `node.ticketFields` (**`status` is not** in
  `ticketFields` after Phase 2.5).
- **VertoAdapter return type & orchestration.** Closed (Phase 2.5) —
  `adapter.loadProject()` → `VertoGraph` only; `runHostPipeline(graph, opts?)` in
  `@verto/text-parser` owns materialize → filter → validate → bundle (§4.6.5, §4.6.8).
- **Status vocabulary.** Closed — workflow `status` on canonical root (from
  tracker); graph math uses `isDone`. Parsed raw lines use `raw` / `done`. Slice-level
  completeness shown via `deliveryCompleteness` Stat + completion-toned pills (Phase 4).
  Status/state-based node colouring on all nodes — `resolveDisplayStatusGroup()` +
  `theme.ts` palette by group index (Phase 4).
- **Vertical priority representation.** Closed — numeric field (1–9) required on all nodes; global ranking via chain-traversal algorithm with normalisation — see §3.5 and `types.ts` `Priority` type.
- **Multi-parent scenarios.** Closed — nodes with multiple upward chains each generate results per chain; the minimum normalised value wins — see §3.5.
- **Black boxes.** Closed (removed) — see §5 of this file.
- **`VertoEdge.reason` vocabulary (known values).** Closed (Phase 2.5) — closed
  union `'parent-child' | 'blocking' | 'parsed-req'` (no open `| string`); see
  `types.ts` and §4.6.8.
- **`prereqIds` consistency validation.** Closed (Phase 2.5) — after
  materialize/filter, assert `prereqIds` = `childIds ∪ _rawReqIds ∪ blocking` edge
  sources (§4.6.8 formula).
- **`ticketUrl` validation severity.** Closed (Phase 2.5) — missing `ticketUrl`
  on ticket nodes is a **validation error** (not a warning), aligned with §4.6.5.

### 6.2 Delivery Map presentation & decomposition

- **Vertical designation (UI behaviour).** Closed (Phase 3) — default:
  `isDeliverySlice = true` for top-level tickets (`parent` is null); override via
  `isDeliverySlice` fieldMappings (§4.6.4, §4.6.7). When no delivery slices are
  present: **empty screen** (auto-promote parents deferred).
- **Delivery Map layout.** Closed (Phase 2.5 / Phase 3 UI) — **single pipeline
  column** per slice: children first, then raw requirement lines; persona/outcome
  header; portfolio table, UsageBar, gap callouts — §3.7. No two-column layout.
- **Raw requirements parsing.** Closed (Phase 2.5) — `RAW_REQ:BEGIN` /
  `RAW_REQ:END` markers; materialize as `nodeType: 'parsed'` via `@verto/text-parser`;
  name/note patterns, synthetic ids, NCN participation when toggle on — §3.6–§3.8,
  §4.6.8.
- **Enable Parsed Requirements toggle.** Closed (Phase 2.5) — global,
  default on, `workspaceState`; filter graph when off — §3.7, §4.6.8.
- **Portfolio columns / UsageBar / gaps.** Closed (Phase 2.5; renamed) —
  `ui.displayStatusGroups` — §4.6.3.
- **Portfolio column matching algorithm.** Closed (Phase 2.5; revised) —
  system **Done** first (`isDone` only); user groups match `statuses` in config order;
  **`others`** for unmapped statuses; column visibility from status-universe sufficiency —
  §4.6.3.
- **DESC blocks (outcome & child notes).** Closed (Phase 2.5) —
  `computeBodyFields` in `@verto/text-parser` sets `_outcome` (first DESC paragraph) on
  ticket nodes at pipeline time; `_note` on children likewise. `ticketFields.body`
  stripped by `panelManager.ts` before webview `'update'` message (§3.7, §4.6.8).
- **UI port fidelity (Delivery Map).** Closed (Phase 3–4) — persona/outcome,
  pipeline, portfolio table (incl. Primary user column), UsageBar, gaps; completion-toned
  slice pills and shared table chrome (Phase 4); canvas black-box section **not** ported.

### 6.3 Adapters & data

- **Adapter package architecture.** Closed — canonical vs tracker-native
  types, package layout (`system_types`, `project_fields` registry, `client`, `mapper`,
  `adapter`), `FieldAccessor` contract, `CANONICAL_VERTO_NODE_KEYS` routing
  (canonical → node root; non-canonical → `node.ticketFields`), and read/write
  pipeline — see §4.6.1–§4.6.5.
- **Configuration model.** Closed — `defaults.verto.config.jsonc` per adapter,
  `.vscode/verto.config.jsonc` workspace overrides, `fieldMappings` (field + value),
  **field-level** merge granularity for `fieldMappings` (workspace entry replaces
  whole default entry; value-level merge deferred), names-only user-facing config,
  runtime ID cache with name fallback, workspace-wins merge — see §4.6.3–§4.6.4.
- **GitHub field conventions (Verto workspace).** Closed (updated Phase 2.5) —
  `isDone` from native `closed` boolean; `isDeliverySlice` from `parent === null` by
  default (overridable); `status` canonical via ProjectV2 `Status` `fieldMappings`
  (optional); `priority` + AI SDLC on ProjectV2 custom columns; `stateReason` passthrough;
  issue type via org-level Issue Type; **`personas` default from issue labels
  `persona:<value>`**; optional `fieldMappings.personas` override — §4.6.7. Field-schema sync:
  [`scripts/sync-github-project-fields.mjs`](./scripts/sync-github-project-fields.mjs).
- **Personas source (GitHub).** Closed (Phase 2.5) — label prefix `persona:`;
  optional `fieldMappings.personas` replaces label extraction — §4.6.4, §4.6.7.
- **Config bootstrap / audit.** Closed (design + library; wizard Phase 4.5) —
  audit step drafts `verto.config.jsonc` from live project shape; `auditProjectScope` /
  `auditRepositoryScope` exported from `@verto/adapter-github` (Phase 4); extension setup
  wizard specified in §4.6.9 (IMPLEMENTATION Phase 4.5).
- **Required-field fallback (read path).** Closed (Phase 2.5) — fail:
  `id`, `title`, `isDone`, `isDeliverySlice`, `ticketUrl`, `prereqIds`, `childIds`,
  `nodeType`, `nodeOrigin`; default `5`: `priority`; optional: `status` (`undefined`),
  `personas` (`[]` or label extraction); enrichment: `_rawReqIds` (`[]` from adapter) —
  see §4.6.5. `nodeType` / `nodeOrigin` stamped by `mapper.ts`.
- **`VertoConfig` schema.** Closed (Phase 2; extended Phase 4) — `fieldMappings`
  is `Record<string, FieldMappingEntry>` nested under `github` in `VertoConfig` when the
  GitHub adapter is selected; `github` is **optional** on `VertoConfig` at the type level
  and required by JSON Schema only when `adapter === "github"`; `from.kind: 'issue' |
  'projectV2'` (extended with `'issueField'` by verto#9, §4.6.4); optional `values` map
  (full-entry replace on merge); optional `type` hint; `scope`-conditional required
  fields inside `github`; JSONC via `comment-json` — see `packages/config/` (`@verto/config`).
- **Read-only MVP vs. write-back day one.** Closed — read-only MVP first
  (Phases 2–4); write-back in Phase 5.
- **GitHub adapter scope.** Closed (Phase 2) — `github.scope: "project" |
  "repository"`; Issues-first API; `github.ownerType: "user" | "organization"`;
  `expandGraphClosure()` for cross-scope refs — see §4.6.7.
- **Beans or Backlog.md / file-system shape.** Closed (October 2026) — superseded by
  the fissue adapter; the on-disk format is defined by fissue (§3 of this file,
  §4.6.10).
- **fissue adapter details.** Closed (Phase 6, read-only) — optional `fissue` block
  `{ root?, fieldMappings? }`; fields checked by name only (the earlier idea of a
  "defined under the other kind" suggestion was dropped: fissue's `kind` is
  informational); `isDeliverySlice` from `subIssues` instead of "no `parent`"; Verto
  registers the fields it needs in fissue as part of write-back, not on load — see
  §4.6.10.
- **`resolveProjectTitle`.** Retired (Phase 6) — the host's adapter switch for the
  panel title became the optional adapter method `projectTitle` (§4.6.5).

### 6.4 Extension & UI

- **UI port fidelity (Phase 3 scope).** Closed — Delivery Map and NCN lenses
  achieve canvas fidelity (Phase 3 foundation + Phase 4 interaction/colouring/tables).
- **DAG layout library.** Closed (Phase 3) — **@xyflow/react** (React
  Flow) for graph UI; **ELK** (`elkjs`) for layout. See §4.8.
- **Extension bundlers.** Closed (Phase 3) — host: **esbuild**; webview:
  **Vite** (§4.8).
- **NCN pan/zoom (Phase 3).** Closed (Phase 4) — enabled in `NcnGraph.tsx`.
- **Theming.** Closed (Phase 4) — Status-based colouring uses VS Code theme
  variables throughout. Palette mapped by display-status-group **array position** in
  `theme.ts` (not user-configurable; no config changes). Display-status pills and dots
  use `statusGroupColor(groupIndex)` everywhere (legend, bar, pipeline, tables, graph).
- **Where the panel lives.** Closed (Phase 3) — **editor tab**
  (`WebviewPanel`).
- **Setup UX (adapter config).** Closed (Phase 4.5) — QuickPick wizard
  (§4.6.9): adapter + issue source, audit, JSONC seed with comments, open in editor;
  config file watcher + debounced refresh (**500–1000 ms**); `github.includeClosedAncestors` for repository
  scope. Re-audit deferred.

### 6.5 Product & process

- **Extension identifiers.** Closed (Phase 3) — product name **Verto**;
  extension display name **Verto**; core package **`@verto/core`** (monorepo
  `workspace:*`, no npm publish); first shell **Verto for VS Code**; extension id
  **`manmilani.verto`**; marketplace publisher **`manmilani`**.
- **Distribution.** Closed (Phase 3) — **private `.vsix`** only (not
  Marketplace).
