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
| 2.5 | [Parsed requirements & Delivery Map model](#phase-25--parsed-requirements--delivery-map-model) | `@verto/text-parser`, canonical schema, portfolio config, shared pipeline | Complete |
| 3 | [VS Code extension — read-only panel](#phase-3--vs-code-extension--read-only-panel) | Installable `.vsix`; Delivery Map + NCN graph with live data | Complete |
| 4 | [Full UI fidelity](#phase-4--full-ui-fidelity) | Canvas-outcome parity: slice priorities, two-mode impl. order, NCN pan/zoom/focus, status colouring | Complete |
| 4.5 | [Setup wizard & config bootstrap](#phase-45--setup-wizard--config-bootstrap) | First-run QuickPick wizard; audit-seeded `verto.config.jsonc`; repository ancestor closure | |
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
| `packages/core/src/algorithms/completeness.ts` | `deliveryCompleteness(graph, nodeId): number` — weighted ratio of done weight to total weight in closure (`nodeWeight(node)`); returns NaN for unknown `nodeId`; `deliveryCompletenessMap(graph)` for bundle builds |
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
| `packages/config/src/types.ts` | `VertoConfig` TypeScript type + `FieldMappingEntry` shape (`from.kind`, value-map, `type` hint); `github?: GitHubConfig` (required only when `adapter === "github"`); includes `github.scope`, scope-conditional required fields inside `github`, and optional `github.issueFilter` for repository scope |
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

**Status:** Complete.

**Goal:** Model, enrichment, config, and shared load pipeline for **raw requirements**
and the unified Delivery Map **Requirement** list — before Phase 3 UI. Supersedes the
prior two-column / display-only body / `REQ:` markers design.

**Depends on:** Phase 2 complete. Phase 2.5 refactors the Phase 2 adapter from
`DeliveryMapBundle` → `VertoGraph` return type.

### Deliverables — `@verto/core` schema & interface

| File | Purpose |
|---|---|
| `packages/core/src/types.ts` | Promote to canonical root: `status`, `nodeType` (`'ticket' \| 'parsed'`), `nodeOrigin`, `personas: string[]`, `created_at?: string`, `weight?: number`, `_rawReqIds: string[]`, `_note?: string`, `_outcome?: string`; `ticketUrl: string` (**required**, not optional); `VertoEdge.reason`: closed union `'parent-child' \| 'blocking' \| 'parsed-req'`; update `CANONICAL_VERTO_NODE_KEYS` |
| `packages/core/src/adapter.ts` | **`loadProject()` return type → `Promise<VertoGraph>`** (breaking change from Phase 1–2) |
| `packages/core/src/validation.ts` | `prereqIds` consistency check (§4.6.8 formula); parsed node id / `_rawReqIds` consistency (`_rawReqIds_integrity`); **`ticketUrl` missing → error** (align with §4.6.5) |

### Deliverables — GitHub adapter (mapper + adapter refactor)

| File | Purpose |
|---|---|
| `packages/adapters/github/mapper.ts` | Stamp `nodeType: 'ticket'`, `nodeOrigin: 'github'`, `_rawReqIds: []`; map `status` to canonical root via `fieldMappings`; **`personas`:** extract from labels `persona:<value>` unless `fieldMappings.personas` override is present |
| `packages/adapters/github/adapter.ts` | Return **`VertoGraph` only** — remove `buildDeliveryMapBundle()` / post-map validation that assumed bundle output |

### Deliverables — `@verto/text-parser`

| File | Purpose |
|---|---|
| `packages/text-parser/package.json` | New workspace package (not a tracker adapter) |
| `packages/text-parser/src/parseRawReqBlock.ts` | Parse `RAW_REQ:BEGIN` / `RAW_REQ:END`; name/note patterns; `[ ]` / `[x]` → `raw`/`done` + `isDone` |
| `packages/text-parser/src/parseDescBlock.ts` | Low-level helper: extract first paragraph of `DESC:BEGIN` / `DESC:END` block (strip HTML comments, split on blank line) |
| `packages/text-parser/src/materialize.ts` | `materializeParsedRequirements(graph): VertoGraph` — creates parsed nodes; sets `_rawReqIds` on parents; sets `_note` on parsed nodes |
| `packages/text-parser/src/computeBodyFields.ts` | `computeBodyFields(graph): VertoGraph` — sets `_note` + `_outcome` on ticket nodes from first DESC paragraph; run after `materializeParsedRequirements` |
| `packages/text-parser/src/filter.ts` | `filterParsedNodes(graph): VertoGraph` |
| `packages/text-parser/src/runHostPipeline.ts` | Shared: `runHostPipeline(graph, opts?: { parsedEnabled?: boolean }): DeliveryMapBundle` — materialize → computeBodyFields → filter? → validate → bundle |
| `packages/text-parser/src/index.ts` | Public exports |
| `packages/text-parser/src/__tests__/` | Parsing, materialize + filter, computeBodyFields, `prereqIds` validation cases |

### Deliverables — `@verto/config`

| File | Purpose |
|---|---|
| `packages/config/src/types.ts` | `UiConfig` with `ui.displayStatusGroups` — source-aware display-status groups (`ticket` / `parsed`); optional `fieldMappings.personas` override (no default binding) |
| `packages/config/src/schema.ts` | JSON Schema for `ui.displayStatusGroups`; `personas` allowed as optional `fieldMappings` key |
| `packages/adapters/github/defaults.verto.config.jsonc` | Seed `ui.displayStatusGroups` (Done / raw); **no** default `personas` field binding (labels are the default source) |

### Deliverables — host load pipeline (shared)

| File | Purpose |
|---|---|
| `scripts/load-project.mjs` | `adapter.loadProject()` → `runHostPipeline(graph, { parsedEnabled: !argv.noParsed })`; `--no-parsed` turns parsed nodes off |
| `scripts/audit-github-project.mjs` | Seed `ui.displayStatusGroups` from discovered Status options + parsed raw/done rules |

### Decisions (resolved)

- **Orchestration (Option A):** `adapter.loadProject()` → **`VertoGraph`** only.
  **`runHostPipeline`** (in `@verto/text-parser`) owns materialize → filter →
  validate → bundle. Adapters never call `materializeParsedRequirements` or
  `buildDeliveryMapBundle()`.

- **Terminology:** `RAW_REQ:BEGIN` / `RAW_REQ:END`; heading **Raw Requirements**; unchecked status **`raw`** (not “black box” / “missing”).
- **Requirement union:** single pipeline column — children first, then raw lines; concat only; no dedupe; no linking.
- **Parsed nodes in NCN:** participate in closure, readiness, leverage, order when toggle **on**; `isDeliverySlice: false`, `priority: 5`, `nodeOrigin: 'text-parser'`.
- **Toggle:** **Enable Parsed Requirements** — global, all lenses, default **on**, `workspaceState`; always materialize in pipeline, `filterParsedNodes` when off; `--no-parsed` for CLI.
- **`status`:** canonical root via `fieldMappings`; optional (`undefined` if unmapped).
- **`nodeType` / `nodeOrigin`:** stamped by `mapper.ts` (`'ticket'` / `'github'`); not `fieldMappings` entries.
- **`ticketUrl`:** required; validation error if missing on ticket nodes.
- **`VertoEdge.reason`:** closed union including `'parsed-req'`.
- **Child sort:** `implementationOrder` → `created_at` (canonical root; missing → last) → issue `id`.
- **Completeness:** weighted — `deliveryCompleteness` uses `nodeWeight()`; parsed rows `isDone ? weight : 0`.
- **Portfolio / UsageBar / gaps:** `ui.displayStatusGroups` — §4.6.3 DESIGN.md; unbucketed rows → implicit **Other** bucket.
- **`personas` (GitHub):** populated per-issue at map time on **all ticket nodes** whose issue carries `persona:<value>` labels (default) or a `fieldMappings.personas` binding — not gated on `isDeliverySlice`. Optional `fieldMappings.personas` override (not in defaults).
- **Slice header (Phase 3 UI):** reads `personas[]` from the selected slice node + DESC outcome; black-box canvas section **removed**.

**Unlocks:** Phase 3 (webview renders bundle with unified pipeline and portfolio widgets).

---

## Phase 3 — VS Code extension (read-only panel)

**Status:** Complete ([issue #5](https://github.com/manmilani/verto/issues/5)).

**Goal:** An installable `.vsix` that opens a Webview panel showing both lenses with live data.
The first point at which Verto can be dogfooded against its own GitHub project.

**Depends on:** Phase 2.5 (parsed requirements pipeline, portfolio config, canonical schema).

**Note:** Phase 3 shipped without the setup wizard; config was seeded by the Phase 2 audit
script or by hand. The first-run setup wizard is **[Phase 4.5](#phase-45--setup-wizard--config-bootstrap)**
(DESIGN.md §4.6.9).

### Deliverables — extension host

| File | Purpose |
|---|---|
| `packages/adapters/github/src/defaults.ts` | Export `githubAdapterDefaults` as a typed JS object — mirrors `defaults.verto.config.jsonc`; imported by `configLoader.ts`; esbuild inlines it at build time |
| `packages/extension/src/shared/protocol.ts` | Typed `HostToWebviewMessage` (`'update'`) and `WebviewToHostMessage` (`'ready'`, `'setParsedEnabled'`, `'persistState'`) unions; `PersistedPanelState`; `Lens` type — imported by both host and webview build targets (see DESIGN.md §4.8) |
| `packages/extension/src/extension.ts` | `activate()`: register open-panel command; wire GitHub auth; register refresh command |
| `packages/extension/src/host/configLoader.ts` | Import `githubAdapterDefaults` from `@verto/adapter-github`; load `.vscode/verto.config.jsonc` via `@verto/config`; deep-merge (workspace wins) |
| `packages/extension/src/host/adapterRegistry.ts` | Adapter selection by `config.adapter` using the shared `VertoAdapter` interface from `@verto/core`; initially only `"github"` |
| `packages/extension/src/host/authProvider.ts` | VS Code built-in GitHub auth provider; injects token into `client.ts` |
| `packages/extension/src/host/loadPipeline.ts` | Calls `adapter.loadProject()` then `runHostPipeline()` from `@verto/text-parser`; reads **Enable Parsed Requirements** from `workspaceState`; rebuilds on toggle change |
| `packages/extension/src/host/panelManager.ts` | `WebviewPanel` lifecycle (editor tab); waits for webview `'ready'` then **strips `ticketFields.body`** from all nodes (body already parsed into `_note`/`_outcome`), then sends `'update'` (`bundle`, `displayStatusGroups`, `parsedEnabled`, `restoredState`); handles `'setParsedEnabled'` (update `workspaceState` + rebuild) and `'persistState'` from webview |
| Extension host build | **esbuild** bundles `packages/extension/src/` → `dist/extension.js` |

### Deliverables — webview (React)

| File | Purpose |
|---|---|
| `packages/extension/src/webview/App.tsx` | Root component: receives `'update'` via `postMessage`; restores lens + focus from `restoredState`; lens switcher; global **Enable Parsed Requirements** toggle (checkbox in toolbar) that sends `'setParsedEnabled'` to host |
| `packages/extension/src/webview/hooks/useVertoState.ts` | Thin `postMessage` ↔ host bridge for bundle updates and UI state persistence (selected lens, `focusedNode`); replaces canvas `useCanvasState` |
| `packages/extension/src/webview/lenses/DeliveryMap.tsx` | Delivery Map lens: pill selector; persona/outcome header; **single pipeline**; child **note** from `node._note` and slice **outcome** from `node._outcome` (pre-computed by host pipeline, §4.6.8); portfolio table, UsageBar, gap callouts (done-bucket rules §4.6.3) |
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
  - **Child ordering:** `implementationOrder` → `created_at` on node root (oldest first; missing → last) → issue `id` (alphanumeric ascending).
  - **Raw ordering:** document order within `RAW_REQ:BEGIN` / `RAW_REQ:END`; ignore `1.`, `2.`, … prefixes.
  - **Parsing:** `@verto/text-parser` (Phase 2.5); not extension `bodyParser`.
  - **Slice picker:** pills (deprecated canvas pattern); **neutral tone** in Phase 3 (completion-based colouring Phase 4).
  - **Portfolio table:** sort slices by `deliveryCompleteness[sliceId]` descending.
  - **UsageBar / display-status groups:** configured `displayStatusGroups` (from `ui.displayStatusGroups` in config) plus implicit **Other** for unbucketed rows; segment value = sum of `weight` (default 1).
  - **Empty states:** no children and toggle off / no raw lines → empty pipeline; no delivery slices → empty screen.
  - **Status:** children show canonical `status`; parsed rows show `raw` / `done`.
  - **Completeness (pipeline rows):** parsed — binary from `isDone` × `weight`; children — `deliveryCompleteness(childId)` (weighted).
  - **Canvas fidelity:** persona/outcome, portfolio table, UsageBar, gaps — **required** in Phase 3.
- **Enable Parsed Requirements** (§5.2) — global toggle, default on, host rebuilds bundle (Phase 2.5 pipeline).
- **Distribution** (§5.5) — private `.vsix` only.
- **Extension display name** — **Verto**.
- **Bundlers** — host: **esbuild**; webview: **Vite**.
- **UI port fidelity** (§5.4) — Delivery Map canvas components required (§3.7); NCN pan/zoom Phase 4.
- **NCN interaction** — React Flow pan/zoom **out** for Phase 3 (Phase 4).
- **Host↔webview message protocol** (§4.8) — typed in `shared/protocol.ts`; `HostToWebviewMessage` carries `'update'` (`bundle`, `displayStatusGroups`, `parsedEnabled`, `restoredState?`); `WebviewToHostMessage` carries `'ready'` / `'setParsedEnabled'` / `'persistState'`; `PersistedPanelState.focusedNode` = selected slice id; host waits for `'ready'` before sending first `'update'`.
- **`displayStatusGroups` in webview payload** (§4.6.3) — sent in `'update'` message alongside `bundle` (sourced from `config.ui.displayStatusGroups`); not part of `DeliveryMapBundle`; keeps `@verto/core` free of config concerns.
- **Enable Parsed Requirements toggle UI** (§5.2) — webview toolbar checkbox; sends `'setParsedEnabled'` to host; host updates `workspaceState`, rebuilds bundle, and sends new `'update'`.
- **Adapter defaults export** (§4.6.3) — `@verto/adapter-github` exports `githubAdapterDefaults` from `src/defaults.ts` (re-exported via `src/index.ts`); `configLoader.ts` imports it directly; no filesystem reads at runtime.

**Unlocks:** Phase 4 (UI features are layered on top of this working foundation).

---

## Phase 4 — Full UI fidelity

**Status:** Complete.

**Goal:** Full parity with the deprecated canvas feature set, adapted to the target
architecture — matching **user-visible outcomes**, not the canvas implementation.

**Canonical behavioural reference:**
[`deprecated_original_canvas/rustybu-vertical-delivery-map.canvas.tsx`](./deprecated_original_canvas/rustybu-vertical-delivery-map.canvas.tsx)
— primarily `GraphView` (NCN lens: journey highlight, pan/zoom, click-to-focus,
implementation-order tables) and slice-priority UI. Rustybu domain content and
inline data are not ported.

**Phase 4 fidelity rule.** For Phase 4 UI, treat the deprecated canvas as the
authoritative **behavioural** spec: what the user sees, can do, and how the product
responds (interaction flows, layout, tables, empty states, focus/highlight
behaviour). Where `DESIGN.md` / `IMPLEMENTATION.md` are silent or vague, **match the
canvas outcome**. Do **not** treat the canvas as a spec for **how** to build it —
copy neither its code structure, state mechanisms, data model, nor Rustybu-specific
content. Implement through Verto’s architecture (host pipeline, `DeliveryMapBundle`,
`postMessage`, VS Code theming, tracker-backed data). Where the design docs
**explicitly** disagree with the canvas on behaviour or data semantics, **the design
docs win**.

> Canvas = what the user experiences; design docs = what the system is; Verto’s
> stack = how we build it.

**Canvas → Verto mapping (planning aid):**

| Canvas concept | Verto equivalent |
|---|---|
| `journeyPriorities` | Slice priority overlay (`workspaceState`) on `isDeliverySlice` nodes |
| Highlight journey (dropdown) | NCN journey/slice subgraph highlight (`GraphView`) |
| `graphFocus` / click focus | NCN click-to-focus neighbourhood (prereqs + dependents); separate from Delivery Map slice selection |
| Clear focus | Restore journey-highlight subgraph (not full graph unless no journey selected) |
| `buildExecutionOrder` / ready table | **Table view toggle** (`ncnTableView`): **Leverage table** (`readyIds` by leverage) or **Implementation order** (full `implementationOrder` when slice priorities are set); user switches manually — not auto-selected from overlay state |
| `STATUS` / pill tones | Status/state-based colouring on **all** nodes via `resolveDisplayStatusGroup()`; palette baked into `theme.ts` by group array position — not config-driven |

**Compute model for interactive priority editing:** the webview sends a `setPriority`
message to the extension host on each change (exact protocol shape defined during
Phase 4 implementation). The host updates the priority overlay, rebuilds the bundle,
and pushes a new `DeliveryMapBundle` via `postMessage`. The webview is a dumb view —
it does **not** bundle `@verto/core` and does **not** recompute. The bundle already
contains `globalPriorityRanking`, `implementationOrder`, `readyIds`, and
`deliveryCompleteness` (Phase 1); `servedBySliceIds` is added in Phase 4.

**Priority overlay integration.** `priorityOverlay.ts` stores per–delivery-slice
priority overrides in `workspaceState` (cleared by Phase 5 write-back). Overrides are
merged into the enriched graph **after** `@verto/text-parser` enrichment and
`validateGraph`, **immediately before** `buildDeliveryMapBundle()`:

```
adapter.loadProject()
  → runHostPipeline(graph, { parsedEnabled, priorityOverlay? })
       → materialize → computeBodyFields → filter? → validate
       → applyPriorityOverlay(graph, overlay)   // slice ids only
       → buildDeliveryMapBundle()
```

Extension `runPipeline(config, token, parsedEnabled, priorityOverlay?)` passes the
overlay through to `runHostPipeline`. The CLI (`scripts/load-project.mjs`) omits the
overlay. Pure helper: `applyPriorityOverlay(graph, overrides): VertoGraph` in
`priorityOverlay.ts`.

### Deliverables (implemented)

| Feature | Location / notes |
|---|---|
| `@verto/adapter-github` audit library | `auditProjectScope` / `auditRepositoryScope` exported from `@verto/adapter-github`; `scripts/audit-github-project.mjs` is a thin CLI |
| `requireGitHubConfig` | `packages/adapters/github/src/githubConfig.ts` — shared guard when `VertoConfig.github` is optional at the type level |
| `resolveProjectTitle` | `packages/extension/src/host/resolveProjectTitle.ts` — adapter-aware panel title (`github` → project/repo name; other adapters → adapter id) |
| `servedBySliceIds` | `packages/core/src/bundle.ts` + `types.ts` — computed in `buildDeliveryMapBundle()` |
| `applyPriorityOverlay` | `packages/text-parser/src/applyPriorityOverlay.ts` — applied in `runHostPipeline` before bundle build |
| `priorityOverlay.ts` | `packages/extension/src/host/priorityOverlay.ts` — `workspaceState` load/save only |
| `loadPipeline.ts` | Threads `priorityOverlay`; builds `priorityOptionHints` via `buildPriorityOptionHints` |
| `@verto/config/priority-hints` | Browser-safe subpath export (`priorityHints.ts`) — P1–P9 labels from `fieldMappings.priority.values` |
| Protocol extensions | `setPriority`, `projectName`, `priorityOverlayActive`, `journeyPriorityOverlay`, `priorityOptionHints`, `ncnHighlightedSliceId`, `ncnFocusedNodeId`, `ncnTableView` on `PersistedPanelState` |
| Priority editor | `PriorityEditor.tsx` — dropdown per delivery slice (P1–P9 + tracker-mapped hints); journeys sorted by overlay priority |
| Implementation order tables | `ImplementationOrderTable.tsx` — leverage view + implementation-order view; shared `DataTableFrame` chrome; status-group dots in `#` column; click row → focus graph node |
| NCN graph | `NcnGraph.tsx` — pan/zoom (`panOnScroll`, `zoomOnScroll`); journey highlight via `servedBySliceIds`; click-to-focus neighbourhood; status-group edge colouring; leverage badges |
| NCN lens chrome | `NcnLens.tsx` — stats, journey selector, `FocusedNodeDetail`, table-view toggle (`Pill`), TOC callout |
| Delivery Map polish | `DeliveryMap.tsx` — canvas-fidelity layout; completion-toned slice pills; **Primary user** portfolio column (`personas`); memoized `pipelinesBySliceId` |
| Display status helpers | `displayStatusGroup.ts` — `resolveDisplayStatusGroup`, `pillToneForNode`, `isGap`, …; `theme.ts` palette by group index |
| Shared webview UI | `components/ui.tsx` — `Pill`, `Stat`, `DataTableFrame`, `StatusDot`, table style helpers, `StatusLegend`, … |

**Unlocks:** [Phase 4.5](#phase-45--setup-wizard--config-bootstrap) (setup wizard; audit library prerequisite met); Phase 5 (write-back).

**Pre–Phase 4 (completed):** `portfolioColumns` renamed to `ui.displayStatusGroups`
with types `DisplayStatusGroup` / `UiConfig`; webview matcher
`resolveDisplayStatusGroup()`; `isDoneBucket` is a structural predicate on a group
entry (gap callouts are one consumer).

### Decisions (resolved for planning)

- **Priority edit scope** — Phase 4 UI edits priority for **delivery slices only**
  (overlay on `isDeliverySlice` nodes). Per-node ticket priority from the tracker
  remains unchanged until Phase 5 write-back.
- **Implementation order table** — two **views** toggled in the NCN lens (leverage vs implementation order); leverage view available even when overlay is active.
- **NCN focus vs Delivery Map slice** — separate concerns; canvas `GraphView`
  behaviour is the outcome reference.
- **Priority overlay hook** — `runPipeline(..., priorityOverlay?)` →
  `runHostPipeline` → `applyPriorityOverlay` before bundle build.
- **`applyPriorityOverlay` location** — pure function `applyPriorityOverlay(graph, overlay): VertoGraph` defined and exported from `@verto/text-parser` (alongside other graph transforms). Extension `priorityOverlay.ts` handles `workspaceState` persistence only; it does not define the transform.
- **Priority column format** — `globalPriorityRanking[id]` displayed by stripping trailing zeros; UI prefixes with `P` (e.g. rank `13` → `P13`). Lower = higher priority; more digits = deeper priority chain.
- **Status display rule** — `displayStatusGroup` label is the display vocabulary everywhere (column headers, legends, node colours, pill tones, UsageBar segments). Per-node status values: `”<displayStatusGroup> (<node.status>)”` when `node.status` is present; `”<displayStatusGroup>”` when absent. No group match: `”Other (<node.status>)”` if status present, else `”Other”`.
- **`DisplayStatusGroup` config schema** — no new fields added in Phase 4. `weight` dropped entirely from the concept. `tone`/`chartColor` not added. Schema remains `label` + `sources` only. Palette baked into `theme.ts` by group array position.
- **`servedBySliceIds` in `DeliveryMapBundle`** — `Record<string, string[]>` added in Phase 4; computed in `buildDeliveryMapBundle()` in `@verto/core`. For each node, lists the delivery-slice ids whose transitive closure contains it. Used by the implementation-order table “Serves” column and the NCN focused-node detail panel.

---

## Phase 4.5 — Setup wizard & config bootstrap

**Goal:** A new user can configure Verto from the extension without hand-writing
`.vscode/verto.config.jsonc`. QuickPick wizard collects adapter + issue source, writes
identity config, runs audit to seed `fieldMappings` and `ui.displayStatusGroups` with
explanatory JSONC comments, opens the file for editing, and loads the panel. Repository
scope gains upward parent closure so the initial `issueFilter` does not need to express
hierarchy.

**Depends on:** Phase 4 (audit library, extension host + webview, `@verto/config`).

**Design reference:** [DESIGN.md §4.6.9](./DESIGN.md#469-first-run-setup-wizard).

### Entry points

| Trigger | Behaviour |
|---|---|
| First `verto.openPanel` | Start setup when config is missing, incomplete, or invalid |
| `verto.setup` command | Always available |
| **Setup** button in webview | Shown only for **missing / incomplete / invalid config** — not for auth failures or GitHub API errors |
| Re-run on existing config | Prompt *"Config exists — re-run setup?"* → **Yes, continue** / **No, cancel**; pre-fill every step from existing `verto.config.jsonc` |

### Wizard flow (QuickPick + input boxes)

1. **Start** — command, first run, or Setup button.
2. **Adapter** — *"Select your ticket/issue tracking system:"* → **GitHub** (only option). Selecting GitHub triggers **VS Code GitHub auth** immediately.
3. **Issues source (authenticated user)** — *"Select your issues source:"*
   - `"-- Source issues from another GitHub owner --"` → **3.b.1**
   - Separator `"By Repository:"` / `"No repositories found."` + repo list (authenticated user's login)
   - Separator `"By Project:"` / `"No projects found."` + project list
   - Selection implies `github.scope` (`repository` vs `project`); no separate scope step.
3.b.1 **Other owner** — input *"Enter GitHub owner's username:"*; adapter resolves owner via **try `user(login)` → `organization(login)`** (adapter-specific), then lists repos/projects.
3.b.2 **Issues source (named owner)** — same tree as 3.a for `<owner_name>`.
4. **Save identity** — first write to `.vscode/verto.config.jsonc` (create `.vscode/` if missing): `adapter`, `github.scope`, `github.owner`, `projectNumber` or `repository`, `ownerType` as resolved; repository-scope limitation comments. This file is **identity-only** (no `fieldMappings`, no `ui.displayStatusGroups`) until step 5 completes.
5. **Audit & enrich** — adapter audit; merge with defaults; write `fieldMappings`, `ui.displayStatusGroups`, explanatory + optional-override comment blocks; **JSONC comment preservation** (no blind `JSON.stringify`). Wizard should run steps 4→5 without yielding to a panel load in between (or hold setup-in-progress so refresh is deferred until step 5 finishes).
6. **Open editor** — open `verto.config.jsonc` in VS Code.
7. **Post-setup** — auto-`refresh()` on the panel.

QuickPick "tree" uses `QuickPickItemKind.Separator` for non-selectable headers and
indented/prefixed child items. List APIs require **cursor pagination**.

### Deliverables — `@verto/config`

| File | Purpose |
|---|---|
| `packages/config/src/schema.ts` | Add `github.includeClosedAncestors` (boolean, default **true** when omitted at runtime) |
| `packages/config/src/types.ts` | `includeClosedAncestors?: boolean` on `GitHubConfig` |
| `packages/config/src/write.ts` (new) | JSONC-aware config writer — merge/update while preserving comments (`comment-json` or equivalent) |
| `packages/config/src/index.ts` | Export `writeVertoConfigFile` |

### Deliverables — `@verto/adapter-github`

| File | Purpose |
|---|---|
| `packages/adapters/github/src/discovery.ts` (new) | `listRepositories(token, owner)`, `listProjects(token, owner)` with cursor pagination; `resolveOwner(token, login)` (user → org). Throws on API failure (distinct from empty list). Wizard catches and shows an error notification + closes QuickPick gracefully — not an unhandled rejection / generic VS Code modal |
| `packages/adapters/github/src/closure.ts` | **Upward parent closure** when `includeClosedAncestors !== false`: for each loaded issue whose `parent` is not in the graph, fetch parent recursively to root |
| `packages/adapters/github/src/adapter.ts` | Call parent closure after `expandGraphClosure` in repository scope |
| `packages/adapters/github/src/audit.ts` | Enhance output for wizard: merge issue-native defaults, `displayStatusGroups`, comment blocks, repo-scope `issueFilter` default + label suggestions |
| `packages/adapters/github/defaults.verto.config.jsonc` | Document `includeClosedAncestors` and default `issueFilter` for repository scope |
| `scripts/audit-github-project.mjs` | Use JSONC-aware writer |

### Deliverables — extension host

| File | Purpose |
|---|---|
| `packages/extension/src/host/setupWizard.ts` (new) | QuickPick flow (§4.6.9); identity write (step 4); audit + enrich write (step 5); open editor (step 6); re-run prompt + pre-fill; catch discovery/list API errors (step 3) — notify user and close wizard cleanly |
| `packages/extension/src/host/configLoader.ts` | Replace single generic load failure with typed errors: **missing** (no file), **incomplete** (file exists but setup not finished — e.g. identity-only after step 4: no workspace `fieldMappings` / `displayStatusGroups` seeded by audit), **invalid** (schema/parse failure). Incomplete and missing → Setup path; do **not** merge defaults and load with silently degraded mappings |
| `packages/extension/src/host/panelManager.ts` | On missing/incomplete/invalid config → offer setup; maps `configLoader` typed errors to `'error'` + `setupRequired: true` for **missing / incomplete / invalid** only — **not** auth or API errors; `createFileSystemWatcher` on `.vscode/verto.config.jsonc` with debounced auto-`refresh()` (**500–1000 ms**) — must fire on **create** as well as change (initial setup writes the file for the first time; watcher registered before wizard must not rely on change-only) |
| `packages/extension/src/extension.ts` | Register `verto.setup`; first-run hook from `verto.openPanel` |
| `packages/extension/package.json` | Contribute `verto.setup` command |

### Deliverables — webview

| File | Purpose |
|---|---|
| `packages/extension/src/shared/protocol.ts` | `WebviewToHostMessage`: `'runSetup'`; extend `'error'` with optional `setupRequired?: boolean` — host sets `setupRequired: true` only when `panelManager` catches a missing / incomplete / invalid config error from `configLoader` |
| `packages/extension/src/webview/App.tsx` | **Setup** button when `'error'` has `setupRequired: true` (missing / incomplete / invalid config); sends `'runSetup'` |

### Repository scope — `issueFilter` and ancestors

| Setting | Value |
|---|---|
| `github.issueFilter` | Default `{ "states": ["OPEN"] }` in generated config (GitHub API cannot express hierarchy) |
| `github.includeClosedAncestors` | Default **`true`**; upward parent walk after initial fetch + `expandGraphClosure` |
| Optional narrowing | Audit discovers labels; commented `issueFilter.labels` / `milestone` suggestions for large repos |

### Decisions (resolved)

- **UI pattern** — QuickPick + input boxes; final step opens JSONC in editor (no setup webview).
- **Auth vs owner** — VS Code GitHub session on adapter pick; `github.owner` may differ via "another owner" branch.
- **`ownerType`** — adapter-specific; GitHub: try user then organization.
- **JSONC writes** — preserve comments on wizard write and config updates.
- **Partial config (steps 4–5)** — identity-only file after step 4 is **incomplete**, not loadable; `configLoader` must not treat it as valid and silently rely on runtime default merge alone. Triggers Setup button / setup flow, same as missing config.
- **Discovery API errors** — list failures in step 3 are explicit wizard errors (notification + graceful close), not empty QuickPick lists.
- **Config file watcher** — `FileSystemWatcher` on create + change; debounce **500–1000 ms** before `refresh()` so first write during setup is observed without refresh storms while editing.
- **Re-audit** — **deferred** beyond initial wizard; when added, must not blindly overwrite user-edited `fieldMappings` keys or `displayStatusGroups`.
- **Not in setup** — parsed-requirements toggle, priority overlay, write-back (runtime / later phases).

**Unlocks:** Self-service onboarding without CLI audit script; Phase 5 can assume most workspaces have a seeded config.

---

## Phase 5 — Write-back

**Depends on:** Phase 4.5 recommended (seeded workspace config) but not strictly blocking.

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
| Delivery Map pipeline — single column, `ui.displayStatusGroups`, personas/outcome | Resolved Phase 2.5 | §3.7, §4.6.3 |
| Display-status group matching algorithm | Resolved Phase 2.5 | §4.6.3, §5.2 |
| Personas source (GitHub `persona:` labels) | Resolved Phase 2.5 | §4.6.7, §5.3 |
| `VertoEdge.reason` closed union + `prereqIds` validation | Resolved Phase 2.5 | §4.6.8, §5.1 |
| Required-field fallback (Phase 2.5 fields) | Resolved Phase 2.5 | §4.6.5, §5.3 |
| Canonical schema — `status`, `nodeType`, `nodeOrigin`, `personas`, `created_at`, `weight`, `_rawReqIds`, `_note`, `_outcome` | Resolved Phase 2.5 | §4.4, `types.ts` |
| Extension identifiers — `manmilani.verto`, publisher `manmilani`, `@verto/*` monorepo-only | Resolved Phase 3 | §5.5 |
| Extension display name — **Verto** | Resolved Phase 3 | §4.8 |
| Distribution — private `.vsix` | Resolved Phase 3 | §5.5 |
| Panel location — editor tab (`WebviewPanel`) | Resolved Phase 3 | §5.4 |
| DAG layout — @xyflow/react + ELK | Resolved Phase 3 | §5.4 |
| Bundlers — esbuild (host), Vite (webview) | Resolved Phase 3 | §4.8 |
| Delivery Map layout — pipeline, portfolio, UsageBar, gaps, pill selector | Resolved Phase 2.5 / 3 | §5.2, §3.7 |
| Raw requirements parsing — `RAW_REQ:BEGIN` / `RAW_REQ:END` | Resolved Phase 2.5 | §4.6.8 |
| Enable Parsed Requirements toggle | Resolved Phase 2.5 | §4.6.8 |
| Child sort tie-break — `implementationOrder` → `created_at` → issue `id` | Resolved Phase 2.5 / 3 | §3.7 |
| Portfolio Other bucket — unbucketed rows | Resolved Phase 3 | §4.6.3, §3.7 |
| Weighted delivery completeness (`nodeWeight()`) | Resolved Phase 2.5 / 3 | §3.3, `completeness.ts` |
| Portfolio sort — `deliveryCompleteness[sliceId]` desc; neutral pills Phase 3 | Resolved Phase 3 | §3.7 |
| UI port fidelity (Delivery Map) — canvas components required | Resolved Phase 3 | §5.4, §3.7 |
| NCN pan/zoom — out for Phase 3 | Resolved Phase 3 | §5.4 |
| Extract audit into `@verto/adapter-github` | Resolved Phase 4 | IMPLEMENTATION Phase 4 |
| Adapter-conditional `github` config block | Resolved Phase 4 | `VertoConfig.github?`; JSON Schema requires `github` only when `adapter === "github"`; `requireGitHubConfig` in adapter |
| Priority edit scope — delivery slices only (overlay) | Resolved Phase 4 | IMPLEMENTATION Phase 4 |
| Implementation order — two-view canvas behaviour | Resolved Phase 4 | IMPLEMENTATION Phase 4 |
| NCN table view toggle (`ncnTableView`) | Resolved Phase 4 | IMPLEMENTATION Phase 4 |
| Priority overlay — `runPipeline` / `runHostPipeline` hook | Resolved Phase 4 | IMPLEMENTATION Phase 4 |
| `applyPriorityOverlay` location — in `@verto/text-parser`, not extension host | Resolved Phase 4 | IMPLEMENTATION Phase 4 |
| Priority column format — strip trailing zeros, `P` prefix in UI | Resolved Phase 4 | IMPLEMENTATION Phase 4 |
| Priority dropdown hints (`@verto/config/priority-hints`) | Resolved Phase 4 | IMPLEMENTATION Phase 4 |
| Status display rule — `displayStatusGroup` everywhere; parenthetical for individual nodes | Resolved Phase 4 | §4.6.3, IMPLEMENTATION Phase 4 |
| `DisplayStatusGroup` config schema — no new fields; `weight` dropped; palette by array position | Resolved Phase 4 | §4.6.3, §5.4 |
| `servedBySliceIds` in `DeliveryMapBundle` — delivery-slice closure membership per node | Resolved Phase 4 | IMPLEMENTATION Phase 4 |
| Status/state node colouring (all nodes) — palette by group index | Resolved Phase 4 | §4.6.3, §4.8, §5.4 |
| NCN pan/zoom and focus | Resolved Phase 4 | IMPLEMENTATION Phase 4 |
| UI port fidelity (NCN + tables) | Resolved Phase 4 | §5.4 |
| Slice-level delivery completeness display | Resolved Phase 4 | Stat + completion-toned slice pills (not a separate progress-bar widget) |
| `resolveProjectTitle` — adapter-aware panel title | Resolved Phase 4 | IMPLEMENTATION Phase 4 |
| Large-graph performance strategy | Deferred (post–Phase 4) | §5.4, unplanned backlog |
| First-run setup wizard | Resolved Phase 4.5 | §4.6.9, IMPLEMENTATION Phase 4.5 |
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
| **Agent / chat workflow integration** | How the Verto panel relates to Cursor agent workflows (DESIGN §5.4) | TBD |

### UI & graph

| Item | Notes | Suggested phase |
|---|---|---|
| **Dedicated slice progress bar widget** | Completeness shown via Stat + pill tones today; optional richer bar UI | TBD |
| **Large-graph performance** | ELK + React Flow tuning for 100+ nodes — evaluate after Phase 4 dogfooding (DESIGN §5.4) | Post–Phase 4 |

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
