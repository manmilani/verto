---
name: github-issues
description: Create, read, update, list, and search GitHub issues via GraphQL; use ProjectV2 for board fields when project context is provided. Use for GitHub issues, project board columns, or structured issue bodies.
disable-model-invocation: false
user-invocable: true
---

# GitHub Issues

GraphQL ref (read on demand): [github-issues-graphql.md](github-issues-graphql.md) · ProjectV2: [projectv2.md](projectv2.md) · Body template: [ticket-body-template.md](ticket-body-template.md)

**Auth:** `GITHUB_TOKEN` or `GITHUB_PERSONAL_ACCESS_TOKEN` (never log/commit). Scopes: `repo` / `public_repo`; ProjectV2 also needs `project`.

**Target repo:** `--owner`/`--repo` · `GITHUB_OWNER`+`GITHUB_REPO` · `GITHUB_REPOSITORY` · else `git remote origin`.

**CLI:** `node <skill-dir>/scripts/gh-issues.mjs` — prefer `--body-file` over inline body (Windows).

| Cmd | Usage |
|-----|-------|
| read | `--number N` |
| create | `--title T --body-file f` |
| update | `--number N --body-file f` (replaces full body) |
| list / search | `list` · `search "repo:O/R …"` |
| template | `--description` · `--acceptance-criteria` · `--definition-of-done` |
| project | `project fields` · `project items` (needs project id) |

**API preference:** **Issues API first** — CRUD, labels, assignees, sub-issues, blocking, issue body. **ProjectV2 second** — when `GITHUB_PROJECT_ID` or `--project-id` (or owner+number) is available: enumerate board items, read/write Status and custom columns. Issue-native fields stay on Issues API even in project scope.

**Checklist numbering:** `1.` not `#1` (GitHub links `#N` to issues).

**Always:** check `data.errors[]`; mutations use node `id`, not issue `number`.
