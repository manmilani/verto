#!/usr/bin/env node
/**
 * GitHub Issues CLI — read, create, update, list, search via GraphQL.
 * Auth: GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN
 */

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const TOKEN =
  process.env.GITHUB_PERSONAL_ACCESS_TOKEN ?? process.env.GITHUB_TOKEN;

function usage() {
  console.error(`Usage:
  gh-issues.mjs read    --number N [--owner O] [--repo R] [--fields f1,f2] [--json]
  gh-issues.mjs create  --title T (--body-file PATH | --body TEXT) [--owner O] [--repo R]
  gh-issues.mjs update  (--number N | --id NODE_ID) (--body-file PATH | --body TEXT) [--title T]
  gh-issues.mjs list    [--owner O] [--repo R] [--state OPEN|CLOSED] [--limit N] [--json]
  gh-issues.mjs search  QUERY [--limit N] [--json]
  gh-issues.mjs template [--description T] [--requirements "a\\nb"] [--acceptance-criteria "a\\nb"]
                        [--definition-of-done "a\\nb"] [--plan T] [--retronotes T] [--final-summary T]
  gh-issues.mjs projects  --number N [--owner O] [--repo R] [--json]
  gh-issues.mjs project fields [--project-id ID] [--project-owner U] [--project-number N] [--org]
  gh-issues.mjs project items  [--project-id ID] [--project-owner U] [--project-number N] [--org] [--limit N] [--json]

Repo resolution (first match wins):
  --owner / --repo flags
  GITHUB_OWNER + GITHUB_REPO env vars
  GITHUB_REPOSITORY env var (owner/repo)
  git remote get-url origin

Project resolution: --project-id, GITHUB_PROJECT_ID, or --project-owner + --project-number
  (or GITHUB_PROJECT_OWNER + GITHUB_PROJECT_NUMBER); add --org for org-owned projects`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function inferRepoFromGit() {
  try {
    const url = execSync('git remote get-url origin', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (m) return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
  } catch {
    /* not in a git repo */
  }
  return null;
}

async function graphql(query, variables = {}) {
  if (!TOKEN) {
    console.error('Missing GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN');
    process.exit(1);
  }
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    console.error('GraphQL errors:', JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  return json.data;
}

function readBody(args) {
  if (args['body-file']) {
    const path = args['body-file'];
    if (!existsSync(path)) {
      console.error(`Body file not found: ${path}`);
      process.exit(1);
    }
    return readFileSync(path, 'utf8');
  }
  if (args.body) return args.body;
  console.error('Provide --body-file or --body');
  process.exit(1);
}

function inferRepoFromEnv() {
  const combined = process.env.GITHUB_REPOSITORY;
  if (combined) {
    const [owner, repo] = combined.split('/');
    if (owner && repo) return { owner, repo: repo.replace(/\.git$/, '') };
  }
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (owner && repo) return { owner, repo: repo.replace(/\.git$/, '') };
  return null;
}

function resolveOwnerRepo(args) {
  const fromEnv = inferRepoFromEnv();
  const fromGit = inferRepoFromGit();
  const owner = args.owner ?? fromEnv?.owner ?? fromGit?.owner;
  const repo = args.repo ?? fromEnv?.repo ?? fromGit?.repo;
  if (!owner || !repo) {
    console.error(
      'Could not resolve owner/repo. Pass --owner and --repo, or set GITHUB_OWNER+GITHUB_REPO / GITHUB_REPOSITORY, or run inside a git repo with a GitHub origin remote.'
    );
    process.exit(1);
  }
  return { owner, repo };
}

async function getRepositoryId(owner, repo) {
  const data = await graphql(
    `query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) { id }
    }`,
    { owner, name: repo }
  );
  if (!data.repository?.id) {
    console.error(`Repository not found: ${owner}/${repo}`);
    process.exit(1);
  }
  return data.repository.id;
}

async function resolveProjectId(args) {
  const direct = args['project-id'] ?? process.env.GITHUB_PROJECT_ID;
  if (direct) return direct;

  const owner = args['project-owner'] ?? process.env.GITHUB_PROJECT_OWNER;
  const number = args['project-number'] ?? process.env.GITHUB_PROJECT_NUMBER;
  if (!owner || !number) {
    console.error(
      'Project context required: --project-id or GITHUB_PROJECT_ID, or --project-owner + --project-number'
    );
    process.exit(1);
  }

  const useOrg = args.org === true || args.org === 'true';
  const query = useOrg
    ? `query($login: String!, $number: Int!) {
        organization(login: $login) { projectV2(number: $number) { id title } }
      }`
    : `query($login: String!, $number: Int!) {
        user(login: $login) { projectV2(number: $number) { id title } }
      }`;
  const data = await graphql(query, {
    login: owner,
    number: parseInt(number, 10),
  });
  const project = useOrg
    ? data.organization?.projectV2
    : data.user?.projectV2;
  if (!project?.id) {
    console.error(`Project not found: ${owner}#${number}`);
    process.exit(1);
  }
  return project.id;
}

async function getIssueId(owner, repo, number) {
  const data = await graphql(
    `query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        issue(number: $number) { id }
      }
    }`,
    { owner, name: repo, number: parseInt(number, 10) }
  );
  if (!data.repository?.issue?.id) {
    console.error(`Issue not found: ${owner}/${repo}#${number}`);
    process.exit(1);
  }
  return data.repository.issue.id;
}

/** ProjectV2 boards an issue belongs to (via Issue.projectItems). */
async function fetchIssueProjects(owner, repo, number) {
  const data = await graphql(
    `query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        issue(number: $number) {
          id
          number
          title
          url
          projectItems(first: 20) {
            nodes {
              id
              project {
                id
                title
                number
                url
                owner { ... on User { login } ... on Organization { login } }
              }
              fieldValues(first: 30) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2Field { name } } }
                  ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2Field { name } } }
                  ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2Field { name } } }
                }
              }
            }
          }
        }
      }
    }`,
    { owner, name: repo, number: parseInt(number, 10) }
  );
  const issue = data.repository?.issue;
  if (!issue) {
    console.error(`Issue not found: ${owner}/${repo}#${number}`);
    process.exit(1);
  }
  return issue;
}

function formatIssueProjects(issue) {
  const items = issue.projectItems?.nodes ?? [];
  if (items.length === 0) {
    console.log(`#${issue.number} ${issue.title}`);
    console.log('No linked ProjectV2 boards.');
    return;
  }
  console.log(`#${issue.number} ${issue.title}`);
  console.log(`${items.length} linked project(s):\n`);
  for (const item of items) {
    const p = item.project;
    const owner = p.owner?.login ?? '?';
    console.log(`  ${p.title} (owner: ${owner}, number: ${p.number})`);
    console.log(`    projectId: ${p.id}`);
    console.log(`    itemId:    ${item.id}`);
    console.log(`    url:       ${p.url}`);
    const fields = (item.fieldValues?.nodes ?? [])
      .map((fv) => {
        const fieldName = fv.field?.name;
        if (!fieldName) return null;
        if (fv.number !== undefined) return `${fieldName}=${fv.number}`;
        if (fv.text !== undefined) return `${fieldName}=${JSON.stringify(fv.text)}`;
        if (fv.name !== undefined) return `${fieldName}=${JSON.stringify(fv.name)}`;
        return null;
      })
      .filter(Boolean);
    if (fields.length) console.log(`    fields:    ${fields.join(', ')}`);
    console.log('');
  }
}

function splitLines(text) {
  return text.split(/\\n|\n/).map((s) => s.trim()).filter(Boolean);
}

function numberedChecklist(items) {
  return items
    .map((text, i) => `- [ ] ${i + 1}. ${text}`)
    .join('\n');
}

function toChecklist(text) {
  if (typeof text !== 'string' || text === '') return '';
  return numberedChecklist(splitLines(text));
}

function buildTemplate(args) {
  const req = toChecklist(args.requirements);
  const ac = toChecklist(args['acceptance-criteria']);
  const dod = toChecklist(args['definition-of-done']);

  return `## Specification
<!-- SECTION:SPECIFICATION:BEGIN -->
#### Description
<!-- DESC:BEGIN -->
${args.description ?? ''}
<!-- DESC:END -->

#### Raw Requirements
<!-- RAW_REQ:BEGIN -->
${req}
<!-- RAW_REQ:END -->

#### Acceptance Criteria
<!-- AC:BEGIN -->
${ac}
<!-- AC:END -->

#### Definition of Done
<!-- DOD:BEGIN -->
${dod}
<!-- DOD:END -->
<!-- SECTION:SPECIFICATION:END -->

## Work
<!-- SECTION:WORK:BEGIN -->
#### Work Plan
<!-- PLAN:BEGIN -->
${args.plan ?? ''}
<!-- PLAN:END -->

#### Work Retrospective Notes
<!-- RETRONOTES:BEGIN -->
${args.retronotes ?? ''}
<!-- RETRONOTES:END -->
<!-- SECTION:WORK:END -->

## Final Summary (V&V)
<!-- FINAL_SUMMARY:BEGIN -->
${args['final-summary'] ?? ''}
<!-- FINAL_SUMMARY:END -->
`;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
if (!command) usage();

switch (command) {
  case 'template': {
    process.stdout.write(buildTemplate(args));
    break;
  }

  case 'read': {
    if (!args.number) {
      console.error('read requires --number');
      process.exit(1);
    }
    const { owner, repo } = resolveOwnerRepo(args);
    const fields = (args.fields ?? 'id,number,title,body,url,state').split(',');
    const selection = fields.join('\n        ');
    const data = await graphql(
      `query($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          issue(number: $number) {
            ${selection}
            labels(first: 20) { nodes { name } }
          }
        }
      }`,
      { owner, name: repo, number: parseInt(args.number, 10) }
    );
    const issue = data.repository?.issue;
    if (!issue) {
      console.error(`Issue not found: ${owner}/${repo}#${args.number}`);
      process.exit(1);
    }
    if (args.json) {
      console.log(JSON.stringify(issue, null, 2));
    } else {
      console.log(`#${issue.number} ${issue.title}`);
      console.log(issue.url ?? '');
      if (issue.state) console.log(`State: ${issue.state}`);
      if (issue.body) {
        console.log('\n--- body ---\n');
        console.log(issue.body);
      }
    }
    break;
  }

  case 'create': {
    if (!args.title) {
      console.error('create requires --title');
      process.exit(1);
    }
    const { owner, repo } = resolveOwnerRepo(args);
    const body = readBody(args);
    const repositoryId = await getRepositoryId(owner, repo);
    const data = await graphql(
      `mutation($repositoryId: ID!, $title: String!, $body: String!) {
        createIssue(input: { repositoryId: $repositoryId, title: $title, body: $body }) {
          issue { id number url }
        }
      }`,
      { repositoryId, title: args.title, body }
    );
    console.log(JSON.stringify(data.createIssue.issue, null, 2));
    break;
  }

  case 'update': {
    const body = readBody(args);
    let issueId = args.id;
    if (!issueId) {
      if (!args.number) {
        console.error('update requires --number or --id');
        process.exit(1);
      }
      const { owner, repo } = resolveOwnerRepo(args);
      issueId = await getIssueId(owner, repo, args.number);
    }
    const input = { id: issueId, body };
    if (args.title) input.title = args.title;
    const data = await graphql(
      `mutation($input: UpdateIssueInput!) {
        updateIssue(input: $input) {
          issue { id number url title }
        }
      }`,
      { input }
    );
    console.log(JSON.stringify(data.updateIssue.issue, null, 2));
    break;
  }

  case 'list': {
    const { owner, repo } = resolveOwnerRepo(args);
    const limit = parseInt(args.limit ?? '20', 10);
    const states = args.state ? [args.state] : ['OPEN'];
    const data = await graphql(
      `query($owner: String!, $name: String!, $first: Int!, $states: [IssueState!]) {
        repository(owner: $owner, name: $name) {
          issues(first: $first, states: $states, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes { id number title state url author { login } }
          }
        }
      }`,
      { owner, name: repo, first: limit, states }
    );
    const issues = data.repository?.issues?.nodes ?? [];
    if (args.json) {
      console.log(JSON.stringify(issues, null, 2));
    } else {
      for (const i of issues) {
        console.log(`#${i.number} [${i.state}] ${i.title} — ${i.url}`);
      }
    }
    break;
  }

  case 'projects': {
    if (!args.number) {
      console.error('projects requires --number');
      process.exit(1);
    }
    const { owner, repo } = resolveOwnerRepo(args);
    const issue = await fetchIssueProjects(owner, repo, args.number);
    if (args.json) {
      const items = (issue.projectItems?.nodes ?? []).map((item) => ({
        itemId: item.id,
        project: {
          id: item.project.id,
          title: item.project.title,
          number: item.project.number,
          url: item.project.url,
          owner: item.project.owner?.login ?? null,
        },
        fieldValues: (item.fieldValues?.nodes ?? []).map((fv) => ({
          name: fv.field?.name,
          number: fv.number,
          text: fv.text,
          singleSelect: fv.name,
        })),
      }));
      console.log(
        JSON.stringify(
          {
            issue: {
              id: issue.id,
              number: issue.number,
              title: issue.title,
              url: issue.url,
            },
            projects: items,
          },
          null,
          2
        )
      );
    } else {
      formatIssueProjects(issue);
    }
    break;
  }

  case 'search': {
    const query = args._.slice(1).join(' ');
    if (!query) {
      console.error('search requires a query string');
      process.exit(1);
    }
    const limit = parseInt(args.limit ?? '20', 10);
    const data = await graphql(
      `query($q: String!, $first: Int!) {
        search(query: $q, type: ISSUE, first: $first) {
          issueCount
          nodes { ... on Issue { id number title state url repository { name owner { login } } } }
        }
      }`,
      { q: query, first: limit }
    );
    const nodes = data.search?.nodes ?? [];
    if (args.json) {
      console.log(JSON.stringify({ issueCount: data.search.issueCount, nodes }, null, 2));
    } else {
      console.log(`Found ${data.search.issueCount} issues`);
      for (const i of nodes) {
        const r = i.repository;
        console.log(`${r.owner.login}/${r.name}#${i.number} [${i.state}] ${i.title}`);
      }
    }
    break;
  }

  case 'project': {
    const sub = args._[1];
    const projectId = await resolveProjectId(args);
    if (sub === 'fields') {
      const data = await graphql(
        `query($id: ID!) {
          node(id: $id) {
            ... on ProjectV2 {
              id title number
              fields(first: 50) {
                nodes {
                  ... on ProjectV2Field { id name }
                  ... on ProjectV2SingleSelectField { id name options { id name } }
                  ... on ProjectV2IterationField { id name }
                }
              }
            }
          }
        }`,
        { id: projectId }
      );
      console.log(JSON.stringify(data.node, null, 2));
    } else if (sub === 'items') {
      const limit = parseInt(args.limit ?? '50', 10);
      const data = await graphql(
        `query($id: ID!, $first: Int!) {
          node(id: $id) {
            ... on ProjectV2 {
              items(first: $first) {
                nodes {
                  id
                  content { ... on Issue { id number title url state } }
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldSingleSelectValue { name field { name } }
                      ... on ProjectV2ItemFieldTextValue { text field { name } }
                      ... on ProjectV2ItemFieldNumberValue { number field { name } }
                    }
                  }
                }
              }
            }
          }
        }`,
        { id: projectId, first: limit }
      );
      const items = data.node?.items?.nodes ?? [];
      if (args.json) {
        console.log(JSON.stringify(items, null, 2));
      } else {
        for (const item of items) {
          const issue = item.content;
          if (issue?.number) {
            console.log(`#${issue.number} [${issue.state}] ${issue.title}`);
          }
        }
      }
    } else {
      console.error('project subcommands: fields, items');
      process.exit(1);
    }
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    usage();
}
