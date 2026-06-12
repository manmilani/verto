# Issue body template

`SECTION:*` = grouping only; all content lives in field markers (`DESC`, `REQ`, `AC`, `DOD`, `PLAN`, `RETRONOTES`, `FINAL_SUMMARY`). Empty fields keep markers. Checklists: `1.` not `#1`.

```markdown
## Specification
<!-- SECTION:SPECIFICATION:BEGIN -->
#### Description
<!-- DESC:BEGIN -->

<!-- DESC:END -->

#### Requirements
<!-- REQ:BEGIN -->
- [ ] 1. …
<!-- REQ:END -->

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

Markers: `SECTION:SPECIFICATION`, `DESC`, `REQ`, `AC`, `DOD`, `SECTION:WORK`, `PLAN`, `RETRONOTES`, `FINAL_SUMMARY` (each `BEGIN`/`END`).
