# Chat context summary — Rustybu deprecated original canvas

Condensed notes on how the deprecated original canvas was built. For the **Verto**
target system, see [../DESIGN.md](../DESIGN.md).

## What the Rustybu canvas mapped

Rustybu is a childcare-management SaaS (Vancouver, BC) — the canvas mapped *that
one product* as a delivery picture. Its standout strength (in the canvas) is the
compliance rules engine; weaknesses include acting on compliance, green-field
domains, AI-assisted business onboarding, and the provider-side plane.

## Files in this folder

| File | Role |
|------|------|
| [`rustybu-vertical-delivery-map.canvas.tsx`](./rustybu-vertical-delivery-map.canvas.tsx) | Verbatim deprecated original canvas (~1,800 lines) — consult during early migration only |
| [`rustybu-vertical-delivery-map.canvas.data.json`](./rustybu-vertical-delivery-map.canvas.data.json) | Example session state |
| [`rustybu-vertical-delivery-map.canvas.status.json`](./rustybu-vertical-delivery-map.canvas.status.json) | Build status sidecar from original IDE host |
| [`chat_060d34f9-1272-4ada-a8d1-dc82873c8d10.jsonl`](./chat_060d34f9-1272-4ada-a8d1-dc82873c8d10.jsonl) | Full chat transcript (historical paths — see [README.md](./README.md)) |

The canvas imports only from `cursor/canvas`. Default export `RustybuDeliveryCanvas`
renders a sticky top **view toggle** (`useCanvasState "view"`): **Delivery map** ↔
**Dependency graph (NCN)**.

## View 1 — `MapView` (original)

16 vertical journeys, each with status-colored pipeline steps (`done`/`partial`/
`designed`/`missing`), a journey selector, per-journey build %, a portfolio table,
and a "biggest black boxes" section. Journey ids: `business-setup`, `onboarding`,
`compliance`, `attendance`, `placement`, `billing`, `staff`, `communication`,
`development`, `health`, `nutrition`, `inventory`, `bi`, `platform`, `saas-ops`,
`customer-support`.

## View 2 — `GraphView` (NCN)

- **~130 work-item nodes** (`NODES`: `id`, `label`, `desc`, `status`, `verts[]`,
  `deps[]`) at subsystem granularity.
- `computeDAGLayout` (horizontal), `DEPENDENTS`, `DOWNSTREAM`, `isReady`,
  `closureFor`, `DANGLING` integrity check.
- Journey selector, node focus, pan/zoom (Ctrl+wheel), toolbar.

## Custom priorities + execution order

- `useCanvasState "journeyPriorities"` — ordered vertical list (P1, P2, …).
- Priority lifts each journey's full necessary-condition closure.
- Implementation order: priority-weighted topological sort when priorities set;
  else ready items by downstream leverage.

## Relationship to Verto

This canvas validated concepts that **Verto** implements properly: NCN graph,
readiness, leverage, priority → implementation order. The deprecated original
uses legacy patterns (`verts[]`, hard-coded `steps[]` with status) that **Verto
does not** — see DESIGN.md §1.6 and §3. This folder will be removed once migration
is far enough along.

**Full prior transcript:** [`chat_060d34f9-1272-4ada-a8d1-dc82873c8d10.jsonl`](./chat_060d34f9-1272-4ada-a8d1-dc82873c8d10.jsonl)
