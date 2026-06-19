import Ajv from 'ajv'
import type { VertoConfig } from './types.js'
import { validateUserDisplayStatusGroups } from './displayStatusGroups.js'

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
    type: { type: 'string', enum: ['text', 'number', 'boolean', 'date', 'select', 'iteration'] },
    isArray: { type: 'boolean' },
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
  required: ['statuses'],
  additionalProperties: false,
  properties: {
    statuses: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', minLength: 1 },
    },
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

  const config = raw as unknown as VertoConfig
  if (config.ui?.displayStatusGroups) {
    validateUserDisplayStatusGroups(config.ui.displayStatusGroups)
  }

  if (config.github?.fieldMappings) {
    for (const [key, entry] of Object.entries(config.github.fieldMappings)) {
      if (entry.isArray === true && entry.type === 'boolean') {
        throw new Error(
          `Invalid VertoConfig: fieldMappings["${key}"] cannot combine isArray:true with type:"boolean"`,
        )
      }
    }
  }

  return config
}
