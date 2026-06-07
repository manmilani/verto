# Deprecated original canvas

**Not a specification. Not an ongoing reference.**

This folder holds a verbatim copy of the Rustybu *Vertical Delivery Map* Cursor
canvas and related chat archives. It exists **only to help with the initial
migration** when implementing Verto for VS Code and `@verto/core`. Once those
pieces no longer need it, this folder **will be deleted**.

For the **target system design**, see [../DESIGN.md](../DESIGN.md).

## Files

| File | Purpose |
|------|---------|
| [rustybu-vertical-delivery-map.canvas.tsx](./rustybu-vertical-delivery-map.canvas.tsx) | Verbatim deprecated original canvas source (~1,800 lines) |
| [rustybu-vertical-delivery-map.canvas.data.json](./rustybu-vertical-delivery-map.canvas.data.json) | Example session state (`journeyPriorities`, view, pan/zoom, …) |
| [rustybu-vertical-delivery-map.canvas.status.json](./rustybu-vertical-delivery-map.canvas.status.json) | Canvas build status sidecar from the original IDE host |
| [chat_summary_1__060d34f9.md](./chat_summary_1__060d34f9.md) | Summary — how the canvas was built (chat 060d34f9) |
| [chat_060d34f9-1272-4ada-a8d1-dc82873c8d10.jsonl](./chat_060d34f9-1272-4ada-a8d1-dc82873c8d10.jsonl) | Full transcript — canvas authoring (historical paths) |
| [chat_summary_2__e4e7087f.md](./chat_summary_2__e4e7087f.md) | Summary — Verto system design & documentation (chat e4e7087) |
| [chat_e4e7087f-e456-4b81-ab72-a7d4a8ddc7be.jsonl](./chat_e4e7087f-e456-4b81-ab72-a7d4a8ddc7be.jsonl) | Full transcript — Verto design (historical paths) |

## Note on the chat transcripts

`chat_*.jsonl` preserves the original conversations verbatim. Paths inside them
(e.g. Cursor `canvases/` dirs, Rustybu `epics/`) are **historical** and point at
the parent project where the canvas was authored. For the canvas copy **in this
repo**, use `rustybu-vertical-delivery-map.canvas.tsx` in this folder.
