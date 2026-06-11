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
| **projects** | `--number N` — list ProjectV2 board(s) linked to an issue |
| project | `project fields` · `project items` (needs project id) |

## Finding ProjectV2 board(s) for an issue

When project context is **unknown** (no `GITHUB_PROJECT_ID` / `--project-id` / owner+number in env):

1. **Discover from the issue** (preferred):
   ```bash
   node <skill-dir>/scripts/gh-issues.mjs projects --number N [--json]
   ```
   Traverses `Issue.projectItems` and returns, per linked board:
   - `projectId`, `title`, `number`, `owner`, `url`
   - `itemId` (needed for `updateProjectV2ItemFieldValue`)
   - current column values (e.g. `ai_tokens_used`, Status)

2. **List field definitions** on a discovered board:
   ```bash
   node <skill-dir>/scripts/gh-issues.mjs project fields --project-id PROJECT_ID
   ```

3. **Set a board column** (e.g. `ai_tokens_used`):
   - Use `updateProjectV2ItemFieldValue` with `projectId`, `itemId`, `fieldId`, and `value: { number }` / `{ text }` / `{ singleSelectOptionId }`.
   - See [projectv2.md](projectv2.md) and [github-issues-graphql.md](github-issues-graphql.md) §5 workflow #6.

**Resolution order:** env/config project id → `projects --number N` from issue → ask user.

**Field location:** Verto SDLC columns (`ai_tokens_used`, `specified_by`, etc.) are **ProjectV2 custom fields**, not repo-native `issueFields`. Try `projects` before `setIssueFieldValue`.

**API preference:** **Issues API first** — CRUD, labels, assignees, sub-issues, blocking, issue body. **ProjectV2 second** — when project context is known or discovered via `projects`: enumerate board items, read/write Status and custom columns. Issue-native fields stay on Issues API even in project scope.

**Checklist numbering:** `1.` not `#1` (GitHub links `#N` to issues).

**Always:** check `data.errors[]`; mutations use node `id`, not issue `number`.
