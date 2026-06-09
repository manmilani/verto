# Verto

Plan and deliver vertical slices from your issue graph using NCN (Necessary
Conditions Network) and TOC (Theory of Constraints) thinking. All tickets are
equal nodes in one graph; the Delivery Map lens shows body documentation and
child tickets side by side for each vertical.

**Start here:** [DESIGN.md](./DESIGN.md) — full intent, model, and system design.

## Repository layout

All paths below are relative to this folder (the **Verto project root**).

| Path | Purpose |
|------|---------|
| [DESIGN.md](./DESIGN.md) | Living design document — source of truth for thinking and decisions |
| [graphql/github_issues_graphql.agent_prompt.md](./graphql/github_issues_graphql.agent_prompt.md) | GitHub GraphQL reference for the GitHub adapter |
| [graphql/hmans_beans_graphql.agent_prompt.md](./graphql/hmans_beans_graphql.agent_prompt.md) | hmans/beans GraphQL reference for the beans adapter |
| [deprecated_original_canvas/](./deprecated_original_canvas/) | Deprecated Rustybu canvas + chat archive — **initial migration aid only**; see [deprecated_original_canvas/README.md](./deprecated_original_canvas/README.md) |

**Status:** Design phase. Canonical schema and adapters are not yet implemented.

**First shell:** Verto for VS Code (and Cursor). Core library: `@verto/core`.
