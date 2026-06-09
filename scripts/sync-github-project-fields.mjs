#!/usr/bin/env node
/**
 * One-off sync: align GitHub ProjectV2 "Project for Verto" custom fields
 * with VertoNode-derived schema (see packages/core/src/types.ts).
 */

const TOKEN =
  process.env.GITHUB_PERSONAL_ACCESS_TOKEN ??
  process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error('Missing GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN');
  process.exit(1);
}

const PROJECT_ID = 'PVT_kwHOBTa1f84BZ8uD';
const USER_LOGIN = 'manmilani';
const PROJECT_NUMBER = 1;

const STATUS_OPTIONS = [
  'Draft',
  'To_Specify',
  'Specifying',
  'To_Plan',
  'Planning',
  'To_Implement',
  'Implementing',
  'To_Verify',
  'Verifying',
  'Closed',
];

const RESOLUTION_OPTIONS = [
  "Done/Resolved",
  'Duplicate',
  "Won't Do",
  'Obsolete',
];

const CUSTOM_FIELDS = [
  {
    name: 'resolution',
    dataType: 'SINGLE_SELECT',
    singleSelectOptions: RESOLUTION_OPTIONS.map((name) => ({
      name,
      color: 'GRAY',
      description: '',
    })),
  },
  { name: 'specified_by', dataType: 'TEXT' },
  { name: 'planned_by', dataType: 'TEXT' },
  { name: 'implemented_by', dataType: 'TEXT' },
  { name: 'verified_by', dataType: 'TEXT' },
  { name: 'ai_tokens_estimate', dataType: 'NUMBER' },
  { name: 'ai_tokens_used', dataType: 'NUMBER' },
  { name: 'ai_model_worker', dataType: 'TEXT' },
  { name: 'ai_model_reviewer', dataType: 'TEXT' },
];

const COLORS = ['GRAY', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'RED', 'PINK', 'PURPLE'];

async function gql(query, variables = {}) {
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
    const err = new Error(json.errors.map((e) => e.message).join('; '));
    err.graphqlErrors = json.errors;
    throw err;
  }
  return json.data;
}

async function fetchProjectFields() {
  const data = await gql(
    `query($login: String!, $number: Int!) {
      user(login: $login) {
        projectV2(number: $number) {
          id
          title
          fields(first: 100) {
            nodes {
              __typename
              ... on ProjectV2FieldCommon { id name dataType }
              ... on ProjectV2SingleSelectField {
                options { id name }
              }
            }
          }
        }
      }
    }`,
    { login: USER_LOGIN, number: PROJECT_NUMBER },
  );
  return data.user.projectV2;
}

async function createProjectField(projectId, field) {
  const input = {
    projectId,
    name: field.name,
    dataType: field.dataType,
  };
  if (field.singleSelectOptions) {
    input.singleSelectOptions = field.singleSelectOptions;
  }
  const data = await gql(
    `mutation($input: CreateProjectV2FieldInput!) {
      createProjectV2Field(input: $input) {
        projectV2Field {
          ... on ProjectV2FieldCommon { id name dataType }
          ... on ProjectV2SingleSelectField { options { id name } }
        }
      }
    }`,
    { input },
  );
  return data.createProjectV2Field.projectV2Field;
}

async function deleteProjectField(fieldId) {
  await gql(
    `mutation($input: DeleteProjectV2FieldInput!) {
      deleteProjectV2Field(input: $input) { clientMutationId }
    }`,
    { input: { fieldId } },
  );
}

async function tryUpdateStatusOptions(statusFieldId, existingOptions) {
  // Attempt known mutation shapes; GitHub may not expose field-schema updates.
  const optionInputs = STATUS_OPTIONS.map((name, i) => {
    const existing = existingOptions.find((o) => o.name === name);
    const input = {
      name,
      color: COLORS[i % COLORS.length],
      description: '',
    };
    if (existing) input.id = existing.id;
    return input;
  });

  const attempts = [
    {
      label: 'updateProjectV2SingleSelectField',
      mutation: `mutation($input: UpdateProjectV2SingleSelectFieldInput!) {
        updateProjectV2SingleSelectField(input: $input) {
          projectV2Field { ... on ProjectV2SingleSelectField { options { id name } } }
        }
      }`,
      input: { fieldId: statusFieldId, options: optionInputs },
    },
    {
      label: 'updateProjectV2Field (options)',
      mutation: `mutation($input: UpdateProjectV2FieldInput!) {
        updateProjectV2Field(input: $input) {
          projectV2Field { ... on ProjectV2SingleSelectField { options { id name } } }
        }
      }`,
      input: { fieldId: statusFieldId, singleSelectOptions: optionInputs },
    },
  ];

  for (const attempt of attempts) {
    try {
      const data = await gql(attempt.mutation, { input: attempt.input });
      return { ok: true, via: attempt.label, data };
    } catch (e) {
      console.warn(`  ${attempt.label}: ${e.message}`);
    }
  }
  return { ok: false };
}

function isBuiltinField(node) {
  const builtins = new Set([
    'TITLE', 'ASSIGNEES', 'LABELS', 'LINKED_PULL_REQUESTS', 'MILESTONE',
    'REPOSITORY', 'REVIEWERS', 'PARENT_ISSUE', 'SUB_ISSUES_PROGRESS',
    'CREATED', 'UPDATED', 'CLOSED', 'TRACKED_BY', 'ISSUE_TYPE',
  ]);
  return builtins.has(node.dataType) || node.name === 'Status';
}

async function main() {
  console.log('Fetching current project fields...');
  const project = await fetchProjectFields();
  console.log(`Project: ${project.title} (${project.id})`);

  const fields = project.fields.nodes;
  const statusField = fields.find((f) => f.name === 'Status');
  const customFields = fields.filter((f) => !isBuiltinField(f));

  console.log('\n--- Status field sync ---');
  if (!statusField) {
    console.error('Status field not found');
  } else {
    const current = statusField.options?.map((o) => o.name) ?? [];
    const missing = STATUS_OPTIONS.filter((s) => !current.includes(s));
    const extra = current.filter((s) => !STATUS_OPTIONS.includes(s));
    console.log(`Current: ${current.join(', ')}`);
    console.log(`Target:  ${STATUS_OPTIONS.join(', ')}`);
    if (missing.length === 0 && extra.length === 0) {
      console.log('Status options already match.');
    } else {
      console.log(`Missing: ${missing.join(', ') || '(none)'}`);
      console.log(`Extra:   ${extra.join(', ') || '(none)'}`);
      const result = await tryUpdateStatusOptions(statusField.id, statusField.options ?? []);
      if (result.ok) {
        console.log(`Status updated via ${result.via}`);
      } else {
        console.log(
          'Could not update Status options via API. Manual update required in GitHub Projects UI.',
        );
      }
    }
  }

  console.log('\n--- Custom field sync ---');
  const byName = new Map(customFields.map((f) => [f.name, f]));

  for (const desired of CUSTOM_FIELDS) {
    const existing = byName.get(desired.name);
    if (!existing) {
      console.log(`CREATE ${desired.name} (${desired.dataType})`);
      const created = await createProjectField(PROJECT_ID, desired);
      console.log(`  -> ${created.id}`);
      continue;
    }

    const typeOk = existing.dataType === desired.dataType;
  const optionsOk =
    desired.dataType !== 'SINGLE_SELECT' ||
    desired.singleSelectOptions.every((o) =>
      existing.options?.some((eo) => eo.name === o.name),
    );

    if (typeOk && optionsOk && existing.dataType !== 'SINGLE_SELECT') {
      console.log(`OK ${desired.name}`);
      continue;
    }

    if (typeOk && optionsOk) {
      console.log(`OK ${desired.name}`);
      continue;
    }

    console.log(`RECREATE ${desired.name} (was ${existing.dataType})`);
    await deleteProjectField(existing.id);
    const created = await createProjectField(PROJECT_ID, desired);
    console.log(`  -> ${created.id}`);
  }

  // Remove custom fields not in schema
  const desiredNames = new Set(CUSTOM_FIELDS.map((f) => f.name));
  for (const f of customFields) {
    if (!desiredNames.has(f.name)) {
      console.log(`DELETE orphan ${f.name}`);
      await deleteProjectField(f.id);
    }
  }

  console.log('\n--- Final state ---');
  const final = await fetchProjectFields();
  for (const f of final.fields.nodes) {
    if (f.name === 'Status' || CUSTOM_FIELDS.some((d) => d.name === f.name)) {
      const opts = f.options?.map((o) => o.name).join(', ');
      console.log(`  ${f.name} [${f.dataType}]${opts ? `: ${opts}` : ''}`);
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  if (e.graphqlErrors) console.error(JSON.stringify(e.graphqlErrors, null, 2));
  process.exit(1);
});
