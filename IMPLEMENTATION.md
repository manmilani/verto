# Verto — Implementation Plan

> See [DESIGN.md](./DESIGN.md) for the full system intent, model, and architecture decisions.
> This document tracks **how** the system will be built — phases, deliverables, and decisions
> that must be resolved before each phase can start.

---

## Phases at a glance

| # | Phase | Key outcome | Status |
|---|---|---|---|
| 0 | [Repository & tooling scaffold](#phase-0--repository--tooling-scaffold) | Buildable, testable monorepo with all packages scaffolded | Complete |
| 1 | [`@verto/core` — algorithms](#phase-1--vertocore--algorithms) | Fully tested, host-agnostic graph algorithm library | Complete |
| 2 | [GitHub adapter — read-only](#phase-2--github-adapter--read-only) | `loadProject()` returns graph from GitHub *(bundle via host pipeline after Phase 2.5)* | Complete |
| 2.5 | [Parsed requirements & Delivery Map model](#phase-25--parsed-requirements--delivery-map-model) | `@verto/parsed-nodes`, canonical schema, portfolio config, shared pipeline | |
| 3 | [VS Code extension — read-only panel](#phase-3--vs-code-extension--read-only-panel) | Installable `.vsix`; Delivery Map + NCN graph with live data | |
| 4 | [Full UI fidelity](#phase-4--full-ui-fidelity) | Priority editor, implementation order, leverage viz, full theming | |
| 5 | [Write-back](#phase-5--write-back) | Bidirectional: UI changes propagate to GitHub | |
| 6 | [Beans (file-system) adapter](#phase-6--beans-file-system-adapter) | Second adapter; Verto manages its own backlog with itself | |

---

## Phase 0 — Repository & tooling scaffold

**Status:** Complete ([issue #3](https://github.com/manmilani/verto/issues/3)).

**Goal:** A buildable, testable monorepo. No domain logic — only the structure that all later
phases depend on.

**Note on existing work:** `packages/core/src/types.ts` already exists with `VertoNode`,
`VertoEdge`, `VertoGraph`, `DeliveryMapBundle`, `Priority`, and `CANONICAL_VERTO_NODE_KEYS`.
Phase 0 wires it into a proper package (build, exports) rather than starting from zero.

### Deliverables

| Path | Purpose |
|---|---|
| `pnpm-workspace.yaml` | Monorepo root; declares all `packages/*` workspaces |
| `package.json` (root) | Root scripts: `build`, `test`, `typecheck` across all packages |
| `tsconfig.base.json` | Shared compiler options; strict, ESNext, path aliases |
| `packages/core/package.json` | `@verto/core` package; build via `tsc` |
| `packages/core/tsconfig.json` | Extends base; emits to `dist/` |
| `packages/core/src/index.ts` | Re-exports types only (algorithms added in Phase 1); makes `import { VertoNode } from '@verto/core'` work immediately |
| `packages/config/package.json` | `@verto/config` package; owns `VertoConfig` type + JSON Schema (added in Phase 2); scaffolded here so the package exists in the workspace from the start |
| `packages/config/tsconfig.json` | Extends base; emits to `dist/` |
| `packages/adapters/github/package.json` | GitHub adapter package; depends on `@verto/core` and `@verto/config` |
| `packages/adapters/github/tsconfig.json` | Extends base |
| `packages/extension/package.json` | VS Code extension manifest (`engines.vscode`, `main`, `activationEvents`, `contributes`); declared dependencies: `@verto/core`, `@verto/config` (needed by `configLoader.ts` in Phase 3) |
| `packages/extension/tsconfig.json` | Extends base; separate configs for host and webview |
| `vitest.config.ts` (root) | Test runner config; workspace mode covering all packages |
| `.github/workflows/ci.yml` | GitHub Actions: type-check + test on every push |
| `packages/extension/.vscode/launch.json` | Extension debug launch config |

**Unlocks:** All subsequent phases.

---

## Phase 1 — `@verto/core` algorithms

**Status:** Complete ([issue #3](https://github.com/manmilani/verto/issues/3)).

**Goal:** A fully tested, host-agnostic library implementing all graph algorithms.
`packages/core/src/types.ts` is already complete — this phase adds the compute layer.

### Deliverables

| File | Exports |
|---|---|
| `packages/core/src/algorithms/closure.ts` | `closureFor(graph, nodeId): Set<string>` — transitive prereq closure |
| `packages/core/src/algorithms/readiness.ts` | `isReady(graph, node): boolean`; `readyNodes(graph): VertoNode[]` |
| `packages/core/src/algorithms/leverage.ts` | `leverageScores(graph): Record<string, number>` — upward transitive dependent count |
| `packages/core/src/algorithms/completeness.ts` | `deliveryCompleteness(graph, nodeId): number` — ratio of `isDone` nodes in closure (0–1) |
| `packages/core/src/algorithms/priority.ts` | `globalPriorityRanking(graph, opts?): Record<string, number>` — chain-traversal algorithm (DESIGN.md §3.5) |
| `packages/core/src/algorithms/order.ts` | `implementationOrder(graph, rankings): string[]` — dependency-respecting, priority-weighted topological sort |
| `packages/core/src/types.ts` | Extended with two new `DeliveryMapBundle` fields: `globalPriorityRanking?: Record<string, number>` and `deliveryCompleteness?: Record<string, number>` |
| `packages/core/src/adapter.ts` | `VertoAdapter<TConfig = unknown>`: `loadProject(config): Promise<VertoGraph>` (**return type updated in Phase 2.5** — was `DeliveryMapBundle` in Phase 1–2); optional `writeBack` |
| `packages/core/src/bundle.ts` | `buildDeliveryMapBundle(graph, opts?): DeliveryMapBundle` — called by the **host load pipeline** (§4.6.5), not by adapters after Phase 2.5 |
| `packages/core/src/validation.ts` | Cycle detection; dangling `prereqIds`/`childIds`; priority out of 1–9 range; `childIds` not subset of `prereqIds`; `ticketUrl` missing (treated as required per §4.6.5) |
| `packages/core/src/index.ts` | Public API re-exports: types + all algorithms + `VertoAdapter` + `buildDeliveryMapBundle` + validation (replaces the types-only stub from Phase 0) |
| `packages/core/src/__tests__/` | Unit tests per algorithm: empty graphs, linear chains, diamonds, multi-parent DAGs, fully-done graphs, all-delivery-slices |

### Notes

- Write tests from the §3.5 examples first — especially the normalisation + minimum-across-chains
  logic in `globalPriorityRanking`; that is the most novel algorithm.
- `MIN_DEPTH_FLOOR` option (§3.5) should be implemented but disabled by default (`undefined`).
- All algorithms must be pure functions over `VertoGraph`; no mutation, no I/O.
- `types.ts` extension: see deliverables table. Both new fields are computed server-side by `buildDeliveryMapBundle()` — the webview does **not** recompute them.

**Unlocks:** Phase 2 (adapter produces `VertoGraph`; core computes `DeliveryMapBundle`).

---

## Phase 2 — GitHub adapter (read-only)

**Status:** Complete ([issue #4](https://github.com/manmilani/verto/issues/4)).

**Goal:** `loadProject(config)` reads issues from a configured GitHub project or repository and
returns a `VertoGraph`. *(Phase 2 shipped `DeliveryMapBundle` from the adapter; Phase 2.5 refactors
to Option A — graph from adapter, bundle from host pipeline.)*

### GitHub scope and API usage

**`github.scope` — a first-class config choice.** The GitHub adapter supports two mutually
exclusive modes, set via `github.scope` in `verto.config.jsonc`:

| `github.scope` | Issue enumeration | Board fields (Status, custom columns) |
|---|---|---|
| `"repository"` | Issues API: `repository(owner, name).issues` | Not available — no project board |
| `"project"` | ProjectV2 API: `user(login).projectV2(number).items` | ProjectV2 API: per-item field values |

**Issues API for all issue-native fields, regardless of scope.** Once the set of issues is
determined, all fields on the issue object are read and written via the Issues GraphQL API:
`id`, `title`, `body`, `closed`, `url`, `stateReason`, issue type, labels, assignees, milestone,
`createdAt`, `updatedAt`, parent/child (`parent`, `subIssues`), and blocking relationships
(`blockedBy`, `blocking`).

**ProjectV2 API — project scope only, and only for two purposes:**
1. Enumerating which issues belong to the configured project (`projectV2.items`)
2. Reading and writing project-board field values: the built-in `Status` single-select and any
   custom columns (`Priority`, `resolution`, AI SDLC metadata)

**Repository scope: no ProjectV2 at all.** `fieldMappings` entries with `"kind": "projectV2"`
are ignored and flagged as gaps by the audit script. Board fields like `status` and `priority`
must be sourced from issue-native fields (labels, milestones, etc.) or left unmapped (priority
defaults to `5`).

**Repository scope: issue filter.** Without narrowing, `repository.issues` returns every issue
in the repo, which is unworkable for large repos. `github.issueFilter` in `verto.config.jsonc`
is an optional but recommended config when scope is `"repository"`, e.g.:
`{ "labels": ["verto"], "states": ["OPEN"] }`. Unfiltered = all open issues in v1;
the audit script flags the absence of a filter as a warning for large repos.

This scope distinction applies to all GitHub interactions: `client.ts` reads, write-back
mutations (Phase 5), and the audit script.

> **DESIGN.md sync note:** At the start of Phase 2, update DESIGN.md §4.6.7 to reflect the
> scope config, the Issues-first API preference, and the split `defaults.verto.config.jsonc`; add
> a cross-link to this section.

### Deliverables

| File | Purpose |
|---|---|
| `packages/config/src/types.ts` | `VertoConfig` TypeScript type + `FieldMappingEntry` shape (`from.kind`, value-map, `type` hint); includes `github.scope: "repository" \| "project"`, scope-conditional required fields (`repository` for repository scope, `owner` + `projectNumber` for project scope), and optional `github.issueFilter` (labels, states, milestone, assignee) for repository scope |
| `packages/config/src/schema.ts` | `VertoConfig` JSON Schema (or `vertoConfig.schema.json` alongside); validates scope-conditional required fields; used by the extension and audit script |
| `packages/config/src/index.ts` | Public re-exports for `@verto/config`; consumed by adapters and the extension (`@verto/core` does not depend on this package) |
| `packages/adapters/github/system_types.ts` | Typed shapes for GitHub GraphQL responses — split by source: Issues API types (`Issue`, blocking/sub-issue links, issue type, labels, assignees, etc.) and ProjectV2 types (project item + field values; only used in project scope) |
| `packages/adapters/github/client.ts` | GraphQL queries branching on `github.scope` (using [`graphql/github_issues_graphql.agent_prompt.md`](./graphql/github_issues_graphql.agent_prompt.md)): repository scope → Issues API only; project scope → ProjectV2 for enumeration + board fields, Issues API for everything else; cursor pagination; auth token injection |
| `packages/adapters/github/project_fields.ts` | Config-driven `FieldAccessor` implementation; reads `fieldMappings` from effective config; routes to canonical root (`CANONICAL_VERTO_NODE_KEYS`) or `node.ticketFields`; skips `"kind": "projectV2"` entries (with a warning) when scope is `"repository"` |
| `packages/adapters/github/mapper.ts` | Composes system + project `FieldAccessor`s; produces `VertoNode[]` + `VertoEdge[]`; applies required-field fallback policy (DESIGN.md §4.6.5). **Refactored in Phase 2.5** — see Phase 2.5 mapper deliverable |
| `packages/adapters/github/adapter.ts` | Implements `VertoAdapter<VertoConfig>`; **`loadProject()` → `VertoGraph`** (Phase 2 shipped `DeliveryMapBundle`; refactored in Phase 2.5) |
| `packages/adapters/github/defaults.verto.config.jsonc` | Two scope variants shipped as commented examples; active defaults for project scope: Issues API fields (`stateReason`, `type`, `labels`, `assignee`, `body`, timestamps) bound via `"kind": "issue"`; ProjectV2-only fields (`status`, `priority`, AI SDLC metadata) bound via `"kind": "projectV2"` |
| `.vscode/verto.config.jsonc` | Workspace config for this repo (Verto's own GitHub project, so `scope: "project"`) |
| `scripts/audit-github-project.mjs` | Evolves `scripts/sync-github-project-fields.mjs`: scope-aware discovery — repository scope queries issue types + labels (Issues API); project scope additionally discovers ProjectV2 custom field names + options; in both cases drafts `.vscode/verto.config.jsonc` by merging with `defaults.verto.config.jsonc` and flags gaps |
| `scripts/load-project.mjs` | Dev smoke-test — **updated in Phase 2.5** to use host load pipeline |

### Decisions to resolve before this phase

- **`VertoConfig` TypeScript + JSON Schema** (§5.3 "VertoConfig schema") — exact shape of
  `fieldMappings` entries (`from.kind` variants, value-map syntax, validation rules), and
  scope-conditional required fields (`repository` vs `owner` + `projectNumber`). Resolved by
  implementing `packages/config/` (`@verto/config`) as the first deliverables in this phase.
- **GitHub operational details** (§5.3) — in-memory ID cache vs. workspace-persisted cache;
  pagination strategy for large projects; rate-limit handling.

**Implementation order within Phase 2:** implement project scope first — Verto's own backlog
uses `scope: "project"`, so it unblocks dogfooding at Phase 3. Repository scope can land in the
same phase or as a fast follow without blocking Phase 3.

**Unlocks:** Phase 2.5 (adapter produces ticket graph; enrichment layer adds parsed nodes).

---

## Phase 2.5 — Parsed requirements & Delivery Map model

**Goal:** Model, enrichment, config, and shared load pipeline for **raw requirements**
and the unified Delivery Map **Requirement** list — before Phase 3 UI. Supersedes the
prior two-column / display-only body / `REQ:` markers design.

**Depends on:** Phase 2 complete. Phase 2.5 refactors the Phase 2 adapter from
`DeliveryMapBundle` → `VertoGraph` return type.

### Deliverables — `@verto/core` schema & interface

| File | Purpose |
|---|---|
| `packages/core/src/types.ts` | Promote to canonical root: `status`, `nodeType` (`'ticket' \| 'parsed'`), `nodeOrigin`, `personas: string[]`, `parsedReqs: string[]`; `ticketUrl: string` (**required**, not optional); `VertoEdge.reason`: closed union `'parent-child' \| 'blocking' \| 'parsed-req'`; update `CANONICAL_VERTO_NODE_KEYS` |
| `packages/core/src/adapter.ts` | **`loadProject()` return type → `Promise<VertoGraph>`** (breaking change from Phase 1–2) |
| `packages/core/src/validation.ts` | `prereqIds` consistency check (§4.6.8 formula); parsed node id / `parsedReqs` consistency; **`ticketUrl` missing → error** (align with §4.6.5) |

### Deliverables — GitHub adapter (mapper + adapter refactor)

| File | Purpose |
|---|---|
| `packages/adapters/github/mapper.ts` | Stamp `nodeType: 'ticket'`, `nodeOrigin: 'github'`, `parsedReqs: []`; map `status` to canonical root via `fieldMappings`; **`personas`:** extract from labels `persona:<value>` unless `fieldMappings.personas` override is present |
| `packages/adapters/github/adapter.ts` | Return **`VertoGraph` only** — remove `buildDeliveryMapBundle()` / post-map validation that assumed bundle output |

### Deliverables — `@verto/parsed-nodes`

| File | Purpose |
|---|---|
| `packages/parsed-nodes/package.json` | New workspace package (not a tracker adapter) |
| `packages/parsed-nodes/src/parseRawReqBlock.ts` | Parse `RAW_REQ:BEGIN` / `RAW_REQ:END`; name/note patterns; `[ ]` / `[x]` → `raw`/`done` + `isDone` |
| `packages/parsed-nodes/src/parseDescBlock.ts` | Extract `DESC:BEGIN` / `DESC:END` text for pipeline notes and slice outcome |
| `packages/parsed-nodes/src/materialize.ts` | `materializeParsedRequirements(graph): VertoGraph` |
| `packages/parsed-nodes/src/filter.ts` | `filterParsedNodes(graph): VertoGraph` |
| `packages/parsed-nodes/src/runHostPipeline.ts` | Shared: `runHostPipeline(graph, opts?: { parsedEnabled?: boolean }): DeliveryMapBundle` — materialize → filter? → validate → bundle (single implementation used by CLI + extension) |
| `packages/parsed-nodes/src/index.ts` | Public exports |
| `packages/parsed-nodes/src/__tests__/` | Parsing, materialize + filter, `prereqIds` validation cases |

### Deliverables — `@verto/config`

| File | Purpose |
|---|---|
| `packages/config/src/types.ts` | Root-level `portfolioColumns` — source-aware buckets (`ticket` / `parsed`); optional `fieldMappings.personas` override (no default binding) |
| `packages/config/src/schema.ts` | JSON Schema for portfolio columns; `personas` allowed as optional `fieldMappings` key |
| `packages/adapters/github/defaults.verto.config.jsonc` | Seed portfolio columns (Done / in-progress / raw); **no** default `personas` field binding (labels are the default source) |

### Deliverables — host load pipeline (shared)

| File | Purpose |
|---|---|
| `scripts/load-project.mjs` | `adapter.loadProject()` → `runHostPipeline(graph, { parsedEnabled: !argv.noParsed })`; `--no-parsed` turns parsed nodes off |
| `scripts/audit-github-project.mjs` | Seed root-level `portfolioColumns` from discovered Status options + parsed raw/done rules |

### Decisions (resolved)

- **Orchestration (Option A):** `adapter.loadProject()` → **`VertoGraph`** only.
  **`runHostPipeline`** (in `@verto/parsed-nodes`) owns materialize → filter →
  validate → bundle. Adapters never call `materializeParsedRequirements` or
  `buildDeliveryMapBundle()`.

- **Terminology:** `RAW_REQ:BEGIN` / `RAW_REQ:END`; heading **Raw Requirements**; unchecked status **`raw`** (not “black box” / “missing”).
- **Requirement union:** single pipeline column — children first, then raw lines; concat only; no dedupe; no linking.
- **Parsed nodes in NCN:** participate in closure, readiness, leverage, order when toggle **on**; `isDeliverySlice: false`, `priority: 5`, `nodeOrigin: 'parsed-nodes'`.
- **Toggle:** **Enable Parsed Requirements** — global, all lenses, default **on**, `workspaceState`; always materialize in pipeline, `filterParsedNodes` when off; `--no-parsed` for CLI.
- **`status`:** canonical root via `fieldMappings`; optional (`undefined` if unmapped).
- **`nodeType` / `nodeOrigin`:** stamped by `mapper.ts` (`'ticket'` / `'github'`); not `fieldMappings` entries.
- **`ticketUrl`:** required; validation error if missing on ticket nodes.
- **`VertoEdge.reason`:** closed union including `'parsed-req'`.
- **Child sort:** unchanged — `implementationOrder` → `createdAt` → issue `id`.
- **Completeness per row:** raw 0%/100% from checkbox; child `deliveryCompleteness(child)`.
- **Portfolio / UsageBar / gaps:** root-level `portfolioColumns` — §4.6.3 DESIGN.md.
- **`personas` (GitHub):** populated per-issue at map time on **all ticket nodes** whose issue carries `persona:<value>` labels (default) or a `fieldMappings.personas` binding — not gated on `isDeliverySlice`. Optional `fieldMappings.personas` override (not in defaults).
- **Slice header (Phase 3 UI):** reads `personas[]` from the selected slice node + DESC outcome; black-box canvas section **removed**.

**Unlocks:** Phase 3 (webview renders bundle with unified pipeline and portfolio widgets).

---

## Phase 3 — VS Code extension (read-only panel)

**Goal:** An installable `.vsix` that opens a Webview panel showing both lenses with live data.
The first point at which Verto can be dogfooded against its own GitHub project.

**Depends on:** Phase 2.5 (parsed requirements pipeline, portfolio config, canonical schema).

**Note:** Phase 3 assumes `.vscode/verto.config.jsonc` is already seeded (by the Phase 2 audit
script or by hand). The first-run setup wizard (DESIGN.md §4.6.3, §4.6.6) is a post–Phase 3
stretch goal — it is not required to dogfood the extension.

### Deliverables — extension host

| File | Purpose |
|---|---|
| `packages/extension/src/extension.ts` | `activate()`: register open-panel command; wire GitHub auth; register refresh command |
| `packages/extension/src/host/configLoader.ts` | Load + deep-merge `defaults.verto.config.jsonc` and `.vscode/verto.config.jsonc`; workspace config wins |
| `packages/extension/src/host/adapterRegistry.ts` | Adapter selection by `config.adapter` using the shared `VertoAdapter` interface from `@verto/core`; initially only `"github"` |
| `packages/extension/src/host/authProvider.ts` | VS Code built-in GitHub auth provider; injects token into `client.ts` |
| `packages/extension/src/host/loadPipeline.ts` | Calls `adapter.loadProject()` then `runHostPipeline()` from `@verto/parsed-nodes`; reads **Enable Parsed Requirements** from `workspaceState`; rebuilds on toggle change |
| `packages/extension/src/host/panelManager.ts` | `WebviewPanel` lifecycle (editor tab); sends `DeliveryMapBundle` via `postMessage` on load and on refresh; persists lens, focus, **Enable Parsed Requirements** to `workspaceState` |
| Extension host build | **esbuild** bundles `packages/extension/src/` → `dist/extension.js` |

### Deliverables — webview (React)

| File | Purpose |
|---|---|
| `packages/extension/src/webview/App.tsx` | Root component: receives bundle via `postMessage`; restores lens + focus from persisted state; lens switcher |
| `packages/extension/src/webview/hooks/useVertoState.ts` | Thin `postMessage` ↔ host bridge for bundle updates and UI state persistence (selected lens, focused node); replaces canvas `useCanvasState` |
| `packages/extension/src/webview/lenses/DeliveryMap.tsx` | Delivery Map lens: pill selector; persona/outcome header; **single pipeline**; child **note** and slice **outcome** via `parseDescBlock` from `@verto/parsed-nodes`; portfolio table, UsageBar, gap callouts (done-bucket rules §4.6.3) |
| `packages/extension/src/webview/lenses/NcnGraph.tsx` | NCN graph lens: `@xyflow/react` + ELK layout; ready/not-done coloring; leverage badges; **no pan/zoom** (Phase 3) |
| `packages/extension/src/webview/theme.ts` | Status color palette mapped to VS Code CSS variables — no hard-coded hex |
| Vite config | Webview bundle: CSP-safe, no inline scripts, tree-shaken; bundles `@xyflow/react` + `elkjs` |

### Decisions (resolved)

- **Panel location** (§5.4) — **editor tab** (`WebviewPanel` / `createWebviewPanel`).
- **DAG layout** (§5.4) — **@xyflow/react** (React Flow) for graph UI; **ELK** (`elkjs`) for layout.
- **Extension identifiers** (§5.5) — publisher `manmilani`; extension id `manmilani.verto`;
  `@verto/*` npm scope monorepo-only (no publish).
- **Delivery Map layout** (§5.2) — see DESIGN.md §3.7:
  - **Terminology:** deprecated canvas `steps[]` = union of child tickets + raw requirement lines (`RAW_REQ` block).
  - **Pipeline:** single column — children first, then raw lines; no dedupe; no linking.
  - **Child ordering:** `implementationOrder` → `createdAt` (oldest first) → issue `id` (alphanumeric ascending).
  - **Raw ordering:** document order within `RAW_REQ:BEGIN` / `RAW_REQ:END`; ignore `1.`, `2.`, … prefixes.
  - **Parsing:** `@verto/parsed-nodes` (Phase 2.5); not extension `bodyParser`.
  - **Slice picker:** pills (deprecated canvas pattern).
  - **Empty states:** no children and toggle off / no raw lines → empty pipeline; no delivery slices → empty screen.
  - **Status:** children show canonical `status`; parsed rows show `raw` / `done`; slice completeness per-row in pipeline.
  - **Canvas fidelity:** persona/outcome, portfolio table, UsageBar, gaps — **required** in Phase 3.
- **Enable Parsed Requirements** (§5.2) — global toggle, default on, host rebuilds bundle (Phase 2.5 pipeline).
- **Distribution** (§5.5) — private `.vsix` only.
- **Extension display name** — **Verto**.
- **Bundlers** — host: **esbuild**; webview: **Vite**.
- **UI port fidelity** (§5.4) — Delivery Map canvas components required (§3.7); NCN pan/zoom Phase 4.
- **NCN interaction** — React Flow pan/zoom **out** for Phase 3 (Phase 4).

**Unlocks:** Phase 4 (UI features are layered on top of this working foundation).

---

## Phase 4 — Full UI fidelity

**Goal:** Full parity with the deprecated canvas feature set, adapted to the target architecture.

**Compute model for interactive priority editing:** the webview sends a `setPriority` message to
the extension host on each change. The host calls `buildDeliveryMapBundle()` and pushes a new
`DeliveryMapBundle` back via `postMessage`. The webview is a dumb view — it does **not** bundle
`@verto/core` and does **not** recompute. The bundle already contains `globalPriorityRanking` and
`deliveryCompleteness` (added to `DeliveryMapBundle` in Phase 1).

### Additions to Phase 3 webview

| Feature | Notes |
|---|---|
| `@verto/adapter-github` audit library | Extract GitHub audit/bootstrap from `scripts/audit-github-project.mjs` into importable `@verto/adapter-github` code; script becomes thin CLI (prerequisite for setup wizard) |
| `packages/extension/src/host/priorityOverlay.ts` | In-memory priority overlay: stores per-node priority overrides; merged into the graph before `buildDeliveryMapBundle()` on each `setPriority` message; persisted to `workspaceState`; cleared by Phase 5 write-back |
| Priority editor | Numeric input (1–9) per delivery slice; sends `setPriority` to host → host updates overlay + recomputes bundle → webview re-renders |
| Implementation order table | Ordered list of ready + incomplete nodes; columns: title, leverage score, delivery slice, ticket link |
| Delivery completeness | Per-slice progress bar from `bundle.deliveryCompleteness[sliceId]` — introduces slice-level "partial" visual treatment deferred from Phase 3 |
| Leverage score in graph | Node size or badge proportional to score from `bundle.leverageScore`; visual emphasis on high-leverage blockers |
| Graph pan, zoom, focus | Click a node → show its delivery subgraph only; click background → full graph |
| Full theming | Every status/state color uses VS Code theme variables; light + dark mode verified |

### Decisions to resolve

- Large-graph performance (§5.4) — simplification strategy for 100+ node graphs (ELK + React Flow tuning).

---

## Phase 5 — Write-back

**Goal:** A PM can set priority, mark items done, add/remove blocking links, or create child
tickets from the Verto panel, and those changes propagate to GitHub.

### Deliverables

| Area | Deliverables |
|---|---|
| Types | `FieldWritePayload` — completes the `FieldAccessor` contract (currently `TODO` in adapter design) |
| Mapper reverse path | `fromVertoNode(node): FieldWritePayload[]` implementations in system + project accessors |
| `client.ts` mutations | Scope-aware: repository scope → Issues API mutations only (close/reopen, add/remove blocking link, create sub-issue; no ProjectV2); project scope → Issues API mutations for the above + ProjectV2 mutations for Status + custom field values (Priority, AI SDLC metadata) |
| `adapter.ts` | `writeBack(changes): Promise<void>` |
| Extension host | Receives change events from webview; calls `writeBack()`; reloads bundle on completion |
| Conflict policy | Decide what happens when live tracker state diverges from the in-memory bundle (§5.3 "Write-back conflict policy") |

### Decisions to resolve before this phase

- Write-back conflict policy (§5.3).
- Whether the priority editor (Phase 4) writes to the tracker immediately or batches changes.

---

## Phase 6 — Beans (file-system) adapter

**Goal:** A second adapter for local Beans-format ticket stores, enabling Verto to load and
display its own development backlog (`backlog/`) with itself.

### Deliverables

| File | Purpose |
|---|---|
| `packages/adapters/beans/system_types.ts` | Typed shapes for Beans tasks (frontmatter fields, dependency links, milestone refs) |
| `packages/adapters/beans/client.ts` | File-system reads (and optionally Beans GraphQL — [`graphql/hmans_beans_graphql.agent_prompt.md`](./graphql/hmans_beans_graphql.agent_prompt.md)) |
| `packages/adapters/beans/mapper.ts` | Beans task → `VertoNode` + `VertoEdge`; maps `dependencies:` to `prereqIds`, `priority:` to 1–9 |
| `packages/adapters/beans/adapter.ts` | `loadProject(config): VertoGraph` *(host pipeline builds bundle — same as GitHub after Phase 2.5)* |
| `packages/adapters/beans/defaults.verto.config.jsonc` | Shipped defaults for Beans field names and priority values |

### Decisions to resolve before this phase

- On-disk format details and dependency/priority conventions (§5.3 "Beans or Backlog.md /
  file-system shape") — the planned `backlog/tasks/*.md` frontmatter and `.beans.yml` format
  give a starting point but need an explicit decision before the adapter contract can be written.

---

## Open decisions summary

The following items from DESIGN.md §5 must be resolved before the phases that depend on them.
Each is linked to the phase where it blocks progress.

| Decision | Blocks / Resolved during | Reference |
|---|---|---|
| `VertoConfig` TypeScript + JSON Schema shape — finalized in Phase 2 as `packages/config/` (`@verto/config`) | Resolved during Phase 2 | §5.3 |
| GitHub adapter scope (`"repository"` vs `"project"`) — finalized in Phase 2 as `github.scope` in `@verto/config` | Resolved during Phase 2 | §4.6.7 |
| GitHub pagination + ID cache strategy | Phase 2 | §5.3 |
| Parsed requirements model — Option A orchestration, `VertoGraph` return type | Resolved Phase 2.5 | §4.6.5, §4.6.8 |
| Delivery Map pipeline — single column, portfolio columns, personas/outcome | Resolved Phase 2.5 | §3.7, §4.6.3 |
| Portfolio column matching algorithm | Resolved Phase 2.5 | §4.6.3, §5.2 |
| Personas source (GitHub `persona:` labels) | Resolved Phase 2.5 | §4.6.7, §5.3 |
| `VertoEdge.reason` closed union + `prereqIds` validation | Resolved Phase 2.5 | §4.6.8, §5.1 |
| Required-field fallback (Phase 2.5 fields) | Resolved Phase 2.5 | §4.6.5, §5.3 |
| Canonical schema — `status`, `nodeType`, `nodeOrigin`, `personas`, `parsedReqs` | Resolved Phase 2.5 | §4.4, `types.ts` |
| Extension identifiers — `manmilani.verto`, publisher `manmilani`, `@verto/*` monorepo-only | Resolved Phase 3 | §5.5 |
| Extension display name — **Verto** | Resolved Phase 3 | §4.8 |
| Distribution — private `.vsix` | Resolved Phase 3 | §5.5 |
| Panel location — editor tab (`WebviewPanel`) | Resolved Phase 3 | §5.4 |
| DAG layout — @xyflow/react + ELK | Resolved Phase 3 | §5.4 |
| Bundlers — esbuild (host), Vite (webview) | Resolved Phase 3 | §4.8 |
| Delivery Map layout — pipeline, portfolio, UsageBar, gaps, pill selector | Resolved Phase 2.5 / 3 | §5.2, §3.7 |
| Raw requirements parsing — `RAW_REQ:BEGIN` / `RAW_REQ:END` | Resolved Phase 2.5 | §4.6.8 |
| Enable Parsed Requirements toggle | Resolved Phase 2.5 | §4.6.8 |
| Child sort tie-break — `implementationOrder` → `createdAt` → issue `id` | Resolved Phase 2.5 / 3 | §3.7 |
| UI port fidelity (Delivery Map) — canvas components required | Resolved Phase 3 | §5.4, §3.7 |
| NCN pan/zoom — out for Phase 3 | Resolved Phase 3 | §5.4 |
| Extract audit into `@verto/adapter-github` | Phase 4 | IMPLEMENTATION Phase 4 |
| Requirements ↔ child ticket linking | Deferred | §5.2 |
| Decomposition CTA (sub-issues from Requirements-only slice) | Deferred | §5.2 |
| Auto-promote parents when no delivery slices | Deferred | §5.2 |
| Slice-level "partial" / delivery completeness bar | Phase 4 | §5.2 |
| Large-graph performance strategy | Phase 4 | §5.4 |
| Write-back conflict policy | Phase 5 | §5.3 |
| Beans on-disk format + dep/priority conventions | Phase 6 | §5.3 |

---

## Unplanned backlog

Items collected here are **not yet assigned** to a numbered implementation phase (or are
only mentioned as stretch goals / open decisions elsewhere). Use this list when deciding
whether to extend an existing phase or insert a new one. Cross-reference [DESIGN.md §5](./DESIGN.md#5-knowledge-gaps).

**Suggested phase** columns are hints only — not commitments.

### Delivery Map & decomposition

| Item | Notes | Suggested phase |
|---|---|---|
| **Requirements ↔ child ticket linking** | Explicit mechanism; current design is concat-only union (DESIGN §5.2) | TBD |
| **Decomposition CTA** | UI action when a slice has raw requirements but no children (DESIGN §5.2) | TBD |
| **Auto-promote parents** | Fallback when no `isDeliverySlice` nodes (empty screen in Phase 3) (DESIGN §5.2) | TBD |
| **Raw requirement numbering cleanup** | Strip `1.`, `2.`, … prefixes from ticket bodies over time; parser already ignores them | TBD |
| **Decomposition workflow** | How children are created: manual command, template, UI action, auto parent-link (DESIGN §5.2) | TBD — likely write-back adjacent |
| **Migrate legacy `REQ:` markers** | Existing tickets with old body markers — ignored for now | TBD |

### Config & adapters

| Item | Notes | Suggested phase |
|---|---|---|
| **First-run setup wizard** | Adapter + project identity, audit, seed `.vscode/verto.config.jsonc`; exact screens / validation UX still open (DESIGN §4.6.3, §4.6.6, §5.4) | Post–Phase 3; after audit library (Phase 4) |
| **Agent / chat workflow integration** | How the Verto panel relates to Cursor agent workflows (DESIGN §5.4) | TBD |

### UI & graph

| Item | Notes | Suggested phase |
|---|---|---|
| **NCN pan/zoom and focus** | React Flow interaction deferred from Phase 3 | Phase 4 |
| **Slice-level delivery completeness bar** | Per-slice progress from `bundle.deliveryCompleteness` | Phase 4 |
| **Large-graph performance** | ELK + React Flow tuning for 100+ nodes (DESIGN §5.4) | Phase 4 |

### Domain, adapters & product (DESIGN §5)

| Item | Notes | Suggested phase |
|---|---|---|
| **Link metadata vocabulary** | `VertoEdge.reason` beyond `parsed-req` — decomposition vs cross-cutting prerequisite (§5.1) | TBD |
| **Additional node fields** | Estimates, iterations/sprints — if/when they feed ordering (§5.1) | TBD |
| **Adapter capability degradation** | Graceful UI when an adapter lacks custom fields, blocking links, … (§5.3) | TBD |
| **Workspace-persisted ID cache** | Deferred from Phase 2 in-memory-only cache (§5.3) | TBD — noted near Phase 5 |
| **Repository strategy** | Core + extension monorepo vs standalone consuming layout (§5.5) | TBD |
| **Team vs. personal state** | Per-user vs per-team priorities/views vs ticket-committed alignment (§5.5) | TBD |
| **Multi-project / multi-repo** | Scope and timing (§5.5) | TBD |
| **Definition of “delivered”** | Vertical delivery metrics; success criteria §2.4 (§5.5) | TBD |
| **Future adapters** | Jira; additional lenses (timeline, risk heatmap, …) (DESIGN §4.10) | TBD |
| **Standalone web shell** | Non-IDE viewer reusing `@verto/core` (§4.10) | TBD |
| **CI validation** | Adapter export snapshots + schema / dangling-dependency checks (§4.10) | TBD |
