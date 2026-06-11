# ProjectV2 (secondary)

Use when project context is known. Issue CRUD still uses Issues API.

## Context (any one)

| Source | Example |
|--------|---------|
| `--project-id` | `PVT_kwHO…` |
| `GITHUB_PROJECT_ID` | env var |
| Owner + number | `--project-owner USER --project-number 1` or `GITHUB_PROJECT_OWNER` + `GITHUB_PROJECT_NUMBER` |

Org-owned projects: query `organization(login: O) { projectV2(number: N) { id } }` instead of `user`.

## CLI

```bash
node <skill-dir>/scripts/gh-issues.mjs project fields
node <skill-dir>/scripts/gh-issues.mjs project items [--limit 50]
```

## Common tasks

**Field/option IDs** — `node(id: PROJECT_ID) { ... on ProjectV2 { fields(first: 30) { nodes { ... on ProjectV2SingleSelectField { id name options { id name } } } } } }`

**Item field values** — on `Issue.projectItems` or project `items` connection; fragments in [github-issues-graphql.md](github-issues-graphql.md) §2.

**Add issue to board** — `addProjectV2ItemById(projectId, contentId: ISSUE_ID)`

**Set Status / column** — `updateProjectV2ItemFieldValue` with `singleSelectOptionId` from field query above.

Full mutations: [github-issues-graphql.md](github-issues-graphql.md) §3.L and §5 workflow #2.
