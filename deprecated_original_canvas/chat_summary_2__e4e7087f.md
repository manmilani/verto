# Chat context summary — Verto system design (chat e4e7087f)

Condensed notes from the chat that turned the Rustybu deprecated original canvas
into the **Verto** product design. For the authoritative spec, see
[../DESIGN.md](../DESIGN.md).

**Full transcript:**
[`chat_e4e7087f-e456-4b81-ab72-a7d4a8ddc7be.jsonl`](./chat_e4e7087f-e456-4b81-ab72-a7d4a8ddc7be.jsonl)
(historical absolute paths inside early lines — see [README.md](./README.md))

**Prior chat (canvas authoring):**
[`chat_summary_1__060d34f9.md`](./chat_summary_1__060d34f9.md)

---

## What this chat was about

Not Rustybu delivery content — **the canvas as a prototype** for a reusable
project-management tool. The conversation moved from “could we extract this?”
through architecture, documentation, model refinements, product naming, folder
hygiene for standalone use, and renaming the legacy canvas archive so it is not
mistaken for ongoing reference.

---

## Key outcomes

### 1. Product direction — **Verto**

- **Name chosen:** **Verto** (over Slicepath, Unwind, etc.) — short, brandable,
  scales to roadmap and multi-agent AI later.
- **Core package:** `@verto/core`
- **First shell:** **Verto for VS Code** (and Cursor)
- **Extension config:** `verto.config.*` (workspace / `.vscode`)

### 2. Architecture (settled)

```
@verto/core  ←  schema, validation, NCN/TOC algorithms (no I/O)
       ↑
  adapter interface  ←  GitHub (first), Jira, Backlog.md, …
       ↑
Verto for VS Code  ←  extension host (I/O, auth) + webview (React UI)
```

- **Tickets are the source of truth** — loaded via pluggable adapters.
- **Declarative YAML/JSON** — not a parallel hand-maintained model; only
  export/cache, CI validation, or file-adapter on-disk format.
- **No git submodule** for shipping the tool (extension + marketplace/VSIX).
- **Standard VS Code extension** — no `cursor/canvas` dependency.

### 3. Graph & data model (major refinements)

| Decision | Detail |
|----------|--------|
| **One graph, all nodes equal** | Every ticket is a node; ~95% identical structure/behaviour. No special graph type for epics. |
| **Terminology** | vertical delivery = vertical slice = user journey = epic (same concept). |
| **Epic specialness** | **Semantic only** — deployable without other slices, standalone customer value. |
| **Delivery subgraph** | For **any** node N: N + full transitive dependency closure = work to deliver N. |
| **Unified links** | Parent/child and BlockedBy/Blocking are the **same** dependency kind (child blocks parent). Reason for link = metadata only. |
| **Body task lists** | Markdown `- [ ]` in **any** ticket body — **documentation only**; graph ignores them entirely. |
| **Decomposition** | Scope → **child tickets**; epic may or may not keep a task list in body. |
| **Delivery Map lens** | Per vertical: **body documentation** (description + optional task lists) **and** **child tickets** side by side. |
| **Legacy canvas** | `verts[]` and `steps[]` with status — deprecated original only, not target model. |

### 4. State split

- **In tickets:** status, dependency links, body, vertical priority, narrative.
- **In workspace config:** adapter choice, repo/project IDs, field mappings, view
  chrome (selected vertical, pan/zoom).

### 5. Documentation & folder layout (current)

| Artifact | Role |
|----------|------|
| [../DESIGN.md](../DESIGN.md) | Living design doc — intention, abstract model, system design, knowledge gaps |
| [../README.md](../README.md) | Entry point + repo layout |
| [../graphql/github-issues.md](../graphql/github-issues.md) | GitHub GraphQL reference for first adapter |
| [deprecated_original_canvas/](./) | Verbatim deprecated original canvas + chat archives |
| [deprecated_original_canvas/README.md](./README.md) | Index of deprecated original files |
| [chat_summary_1__060d34f9.md](./chat_summary_1__060d34f9.md) | Prior chat — how the canvas was built |
| [chat_summary_2__e4e7087f.md](./chat_summary_2__e4e7087f.md) | This chat — Verto design & documentation |

**Folder timeline:** `vertical_delivery/` → **`.verto/`** (Verto project root).

**Archive rename:** `reference_canvas/` → **`deprecated_original_canvas/`** — the
canvas copy is an **initial migration aid only**, not an ongoing spec or
reference. It will be removed once migration is complete. All active docs use
“deprecated original” wording.

### 6. Knowledge gaps (still open — see DESIGN.md §5)

Notable open areas: final canonical schema (designer-led), status vocabulary,
vertical designation in trackers, Delivery Map layout, link metadata, black boxes,
extension ids, read-only vs write-back MVP.

**Closed during this chat:** parent/child = BlockedBy for graph math; task lists
≠ graph state; journey pipeline = body + children not `steps[]`; product naming
(Verto / `@verto/core` / Verto for VS Code); standalone path hygiene; deprecated
original canvas naming.

---

## Conversation arc (by topic)

1. **Canvas review** — confirmed two lenses, NCN, priorities, implementation order; canvas is bespoke/single-product.
2. **Standalone web app?** — feasible via schema + core + adapters + UI shell; dual model (`JOURNEYS` vs `NODES`) is main drift risk.
3. **VS Code extension vs submodule** — extension preferred; submodule not needed for the tool; GitHub issues + epic task lists + sub-issues mapping agreed in principle.
4. **Document everything** — created folder, copied canvas verbatim, drafted `DESIGN.md` with five sections + knowledge gaps.
5. **Doc review for new agents** — ~85–90% coverage; suggested §1.6, YAML clarification, node-uniformity, path self-containment.
6. **Model clarifications** — rooted subgraph / delivery subgraph; node equality; envisioning notes = any-ticket body docs; Delivery Map = body + children.
7. **Naming** — Verto vs Slicepath vs Unwind vs others; **Verto** selected; docs updated (`@verto/core`, Verto for VS Code, `verto.config.*`).
8. **Pre-move hygiene** — user renamed folder to `.verto/`; all doc paths made relative to project root; `chat_summary_1`, `chat_summary_2`, and archive README added; jsonl left as historical archive for early lines.
9. **Archive rename** — `reference_canvas/` → `deprecated_original_canvas/`; all active docs updated so the folder is clearly **migration aid only**, not ongoing reference.
10. **Chat archive refresh** — `chat_summary_2` and `chat_e4e7087f-….jsonl` updated to reflect current state (this file).

---

## Current `.verto/` layout

```
.verto/
├── README.md
├── DESIGN.md
├── graphql/
│   └── github-issues.md
└── deprecated_original_canvas/
    ├── README.md
    ├── rustybu-vertical-delivery-map.canvas.tsx
    ├── rustybu-vertical-delivery-map.canvas.data.json
    ├── rustybu-vertical-delivery-map.canvas.status.json
    ├── chat_summary_1__060d34f9.md
    ├── chat_summary_2__e4e7087f.md
    ├── chat_060d34f9-1272-4ada-a8d1-dc82873c8d10.jsonl
    └── chat_e4e7087f-e456-4b81-ab72-a7d4a8ddc7be.jsonl
```

---

## What to read next

1. [../DESIGN.md](../DESIGN.md) — target system (source of truth)
2. [rustybu-vertical-delivery-map.canvas.tsx](./rustybu-vertical-delivery-map.canvas.tsx) — deprecated original UI/algorithms (early migration only)
3. [chat_summary_1__060d34f9.md](./chat_summary_1__060d34f9.md) — how the deprecated original canvas was built

**Not started:** `@verto/core`, VS Code extension, adapters, final schema, removal of `deprecated_original_canvas/` when migration is done.
