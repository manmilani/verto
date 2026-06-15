# Issue body template

`SECTION:*` = grouping only; all content lives in field markers (`DESC`, `RAW_REQ`, `AC`, `DOD`, `PLAN`, `RETRONOTES`, `FINAL_SUMMARY`). Empty fields keep markers. Checklists: `1.` not `#1`.

**Verto:** checklist items between `RAW_REQ:BEGIN` and `RAW_REQ:END` are materialized as `nodeType: 'parsed'` graph nodes when **Enable Parsed Requirements** is on (document order within the block).

```markdown
## Specification
<!-- SECTION:SPECIFICATION:BEGIN -->
#### Description
<!-- DESC:BEGIN -->

<!-- DESC:END -->

#### Raw Requirements
<!-- RAW_REQ:BEGIN -->
- [ ] 1. …
<!-- RAW_REQ:END -->

#### Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] 1. …
<!-- AC:END -->

#### Definition of Done
<!-- DOD:BEGIN -->
- [ ] 1. …
<!-- DOD:END -->
<!-- SECTION:SPECIFICATION:END -->

## Work
<!-- SECTION:WORK:BEGIN -->
#### Work Plan
<!-- PLAN:BEGIN -->

<!-- PLAN:END -->

#### Work Retrospective Notes
<!-- RETRONOTES:BEGIN -->

<!-- RETRONOTES:END -->
<!-- SECTION:WORK:END -->

## Final Summary (V&V)
<!-- FINAL_SUMMARY:BEGIN -->

<!-- FINAL_SUMMARY:END -->
```

Markers: `SECTION:SPECIFICATION`, `DESC`, `RAW_REQ`, `AC`, `DOD`, `SECTION:WORK`, `PLAN`, `RETRONOTES`, `FINAL_SUMMARY` (each `BEGIN`/`END`).
