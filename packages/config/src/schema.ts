import Ajv from 'ajv'
import type { VertoConfig } from './types.js'

const ajv = new Ajv({ allErrors: true })

const fieldMappingEntrySchema = {
  type: 'object',
  required: ['from'],
  additionalProperties: false,
  properties: {
    from: {
      type: 'object',
      required: ['kind', 'field'],
      additionalProperties: false,
      properties: {
        kind: { type: 'string', enum: ['issue', 'projectV2'] },
        field: { type: 'string' },
      },
    },
    values: { type: 'object' },
    type: { type: 'string', enum: ['text', 'number', 'date', 'select', 'iteration'] },
  },
}

const fieldMappingsSchema = {
  type: 'object',
  additionalProperties: fieldMappingEntrySchema,
}

const githubConfigSchema = {
  type: 'object',
  required: ['scope', 'owner'],
  properties: {
    scope: { type: 'string', enum: ['project', 'repository'] },
    owner: { type: 'string' },
    ownerType: { type: 'string', enum: ['user', 'organization'] },
    includeClosedAncestors: { type: 'boolean' },
    fieldMappings: fieldMappingsSchema,
    // project scope
    projectNumber: { type: 'number' },
    // repository scope
    repository: { type: 'string' },
    issueFilter: {
      type: 'object',
      additionalProperties: false,
      properties: {
        labels: { type: 'array', items: { type: 'string' } },
        states: { type: 'array', items: { type: 'string', enum: ['OPEN', 'CLOSED'] } },
        milestone: { type: 'string' },
        assignee: { type: 'string' },
      },
    },
  },
  if: { properties: { scope: { const: 'project' } } },
  then: { required: ['projectNumber'] },
  else: { required: ['repository'] },
}

const displayStatusGroupSourceRuleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    isDone: { type: 'boolean' },
    statuses: { type: 'array', items: { type: 'string', minLength: 1 } },
  },
}

const displayStatusGroupsSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['label', 'sources'],
    additionalProperties: false,
    properties: {
      label: { type: 'string', minLength: 1 },
      sources: {
        type: 'object',
        minProperties: 1,
        additionalProperties: false,
        properties: {
          ticket: displayStatusGroupSourceRuleSchema,
          parsed: displayStatusGroupSourceRuleSchema,
        },
      },
    },
  },
}

const uiConfigSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    displayStatusGroups: displayStatusGroupsSchema,
  },
}

const vertoConfigSchema = {
  type: 'object',
  required: ['adapter'],
  additionalProperties: true,
  properties: {
    adapter: { type: 'string' },
    github: githubConfigSchema,
    ui: uiConfigSchema,
  },
  allOf: [
    {
      if: { properties: { adapter: { const: 'github' } }, required: ['adapter'] },
      then: { required: ['github'] },
    },
  ],
}

const validate = ajv.compile(vertoConfigSchema)

export function validateVertoConfig(raw: unknown): VertoConfig {
  if (!validate(raw)) {
    const msg =
      validate.errors?.map(e => `${e.instancePath} ${e.message}`.trim()).join('; ') ?? 'unknown'
    throw new Error(`Invalid VertoConfig: ${msg}`)
  }

  return raw as unknown as VertoConfig
}
