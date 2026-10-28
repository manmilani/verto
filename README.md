# Verto

Plan and deliver vertical slices from your issue graph using NCN (Necessary
Conditions Network) and TOC (Theory of Constraints) thinking. All tickets are
equal nodes in one graph; raw requirement lines from ticket bodies can be
materialized as parsed nodes. The Delivery Map lens shows a **single pipeline**
per slice — child tickets first, then raw requirements — with portfolio stats
and gap callouts.

**Start here:** [DESIGN.md](./DESIGN.md) — full intent, model, and system design.

## Repository layout

All paths below are relative to this folder (the **Verto project root**).

| Path | Purpose |
|------|---------|
| [DESIGN.md](./DESIGN.md) | Living design document — source of truth for the current design |
| [DESIGN-History.md](./DESIGN-History.md) | Origin, retired and rejected designs, resolved knowledge gaps |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Implementation plan — phases, deliverables, and open decisions |
| [graphql/github_issues_graphql.agent_prompt.md](./graphql/github_issues_graphql.agent_prompt.md) | GitHub GraphQL reference for the GitHub adapter |
| [deprecated_original_canvas/](./deprecated_original_canvas/) | Deprecated Rustybu canvas + chat archive — **initial migration aid only**; see [deprecated_original_canvas/README.md](./deprecated_original_canvas/README.md) |

**Status:** Phases 0–4 complete (monorepo scaffold, `@verto/core`, GitHub adapter, `@verto/text-parser`, canonical schema, host pipeline, VS Code extension panel, full UI fidelity); Phase 5 shared write-back and Phase 6 complete ([fissue](https://github.com/manmilani/fissue) adapter, read + write). See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for what's next.

**Adapters:**

| Adapter | Source | Minimal `.vscode/verto.config.jsonc` | Write-back |
|---|---|---|---|
| `github` | GitHub Issues and Projects | Created by the setup wizard (**Verto: Setup**) | Not yet: edits are a local preview |
| `fissue` | Local [fissue](https://github.com/manmilani/fissue) tickets (needs the fissue extension) | `{ "adapter": "fissue" }` | Yes |

**Editing:** in the NCN lens, focus a ticket to edit its title, status, done state, priority, personas and blockers, or add a child ticket; journey priorities are edited in the implementation-order view. Edits collect in a draft (toolbar: *N pending*, **Write back**, **Discard all**). Setting `verto.writeBack.mode`: `draft` (default) or `immediate` (write after each edit). Priority is 1–9 (lower = more important); 5 is the default, and isn't written to tickets that have no priority. A write that needs a missing tracker field (e.g. fissue `priority`) asks once to register it and add its `fieldMappings` entry.

**Load script:** `node --import tsx/esm scripts/load-project.mjs [--workspace <dir>] [--fissue-core <path>] [--no-parsed]` prints the bundle for a workspace's config (`GITHUB_TOKEN` only for GitHub; run `pnpm -r build` first).

**First shell:** Verto for VS Code (and Cursor) — extension **Verto** (`manmilani.verto`), distributed as private `.vsix`. Core library: `@verto/core` (monorepo-only).
