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

const portfolioColumnSourceRuleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    isDone: { type: 'boolean' },
    statuses: { type: 'array', items: { type: 'string' } },
  },
}

const portfolioColumnsSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['label', 'sources'],
    additionalProperties: false,
    properties: {
      label: { type: 'string' },
      sources: {
        type: 'object',
        minProperties: 1,
        additionalProperties: false,
        properties: {
          ticket: portfolioColumnSourceRuleSchema,
          parsed: portfolioColumnSourceRuleSchema,
        },
      },
    },
  },
}

const vertoConfigSchema = {
  type: 'object',
  required: ['adapter', 'github'],
  additionalProperties: true,
  properties: {
    adapter: { type: 'string' },
    github: githubConfigSchema,
    portfolioColumns: portfolioColumnsSchema,
  },
}

const validate = ajv.compile(vertoConfigSchema)

export function validateVertoConfig(raw: unknown): VertoConfig {
  if (!validate(raw)) {
    const errors = validate.errors?.map(e => `${e.instancePath} ${e.message}`).join('; ')
    throw new Error(`Invalid VertoConfig: ${errors}`)
  }
  return raw as unknown as VertoConfig
}
