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
| [DESIGN.md](./DESIGN.md) | Living design document — source of truth for thinking and decisions |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Implementation plan — phases, deliverables, and open decisions |
| [graphql/github_issues_graphql.agent_prompt.md](./graphql/github_issues_graphql.agent_prompt.md) | GitHub GraphQL reference for the GitHub adapter |
| [graphql/hmans_beans_graphql.agent_prompt.md](./graphql/hmans_beans_graphql.agent_prompt.md) | hmans/beans GraphQL reference for the beans adapter |
| [deprecated_original_canvas/](./deprecated_original_canvas/) | Deprecated Rustybu canvas + chat archive — **initial migration aid only**; see [deprecated_original_canvas/README.md](./deprecated_original_canvas/README.md) |

**Status:** Phases 0–2.5 complete (monorepo scaffold, `@verto/core`, GitHub adapter, `@verto/text-parser`, canonical schema, host pipeline). Next: **Phase 3** (VS Code extension — read-only Delivery Map + NCN graph panel).

**First shell:** Verto for VS Code (and Cursor) — extension **Verto** (`manmilani.verto`), distributed as private `.vsix`. Core library: `@verto/core` (monorepo-only).
