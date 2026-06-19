import { describe, it, expect } from 'vitest'
import {
  resolveProjectV2FieldName,
  resolveStatusProjectV2FieldName,
  statusOptionsFromProjectFields,
  seedCanonicalProjectV2FieldMapping,
  projectFieldNamesMatch,
  findProjectFieldNode,
} from '../projectField.js'

describe('projectFieldNamesMatch', () => {
  it('compares case-insensitively', () => {
    expect(projectFieldNamesMatch('Status', 'status')).toBe(true)
    expect(projectFieldNamesMatch('Workflow Status', 'workflow status')).toBe(true)
  })
})

describe('resolveProjectV2FieldName', () => {
  it('reads ProjectV2 field name from fieldMappings.status', () => {
    expect(resolveProjectV2FieldName({
      status: { from: { kind: 'projectV2', field: 'Workflow Status' }, type: 'select' },
    }, 'status')).toBe('Workflow Status')
  })

  it('falls back to adapter default Status when mapping omitted', () => {
    expect(resolveProjectV2FieldName(undefined, 'status')).toBe('Status')
  })

  it('returns undefined for priority when unmapped and no adapter default', () => {
    expect(resolveProjectV2FieldName(undefined, 'priority')).toBeUndefined()
  })

  it('returns undefined when status maps to a non-projectV2 source', () => {
    expect(resolveProjectV2FieldName({
      status: { from: { kind: 'issue', field: 'state' } },
    }, 'status')).toBeUndefined()
  })
})

describe('resolveStatusProjectV2FieldName', () => {
  it('delegates to resolveProjectV2FieldName for status', () => {
    expect(resolveStatusProjectV2FieldName({
      status: { from: { kind: 'projectV2', field: 'Workflow Status' }, type: 'select' },
    })).toBe('Workflow Status')
  })
})

describe('statusOptionsFromProjectFields', () => {
  const fields = [
    { name: 'Workflow Status', options: [{ name: 'Draft' }, { name: 'Doing' }] },
    { name: 'Status', options: [{ name: 'Open' }, { name: 'Closed' }] },
  ]

  it('matches project field case-insensitively from configured mapping', () => {
    expect(statusOptionsFromProjectFields(fields, {
      status: { from: { kind: 'projectV2', field: 'Workflow Status' }, type: 'select' },
    })).toEqual(['Draft', 'Doing'])
    expect(statusOptionsFromProjectFields(fields, {
      status: { from: { kind: 'projectV2', field: 'status' }, type: 'select' },
    })).toEqual(['Open', 'Closed'])
  })

  it('uses default Status mapping when fieldMappings omitted', () => {
    expect(statusOptionsFromProjectFields(fields, undefined)).toEqual(['Open', 'Closed'])
  })

  it('returns empty when configured field is absent from project', () => {
    expect(statusOptionsFromProjectFields(fields, {
      status: { from: { kind: 'projectV2', field: 'Missing Column' }, type: 'select' },
    })).toEqual([])
  })
})

describe('seedCanonicalProjectV2FieldMapping', () => {
  const fields = [
    { name: 'Workflow Status', dataType: 'SINGLE_SELECT', options: [{ name: 'A' }] },
    { name: 'priority', dataType: 'SINGLE_SELECT', options: [{ name: 'High' }] },
  ]

  it('prefers workspace input mapping', () => {
    const mappings: Record<string, { from: { kind: 'projectV2'; field: string }; type?: 'select' }> = {}
    seedCanonicalProjectV2FieldMapping(mappings, fields, 'status', {
      status: { from: { kind: 'projectV2', field: 'Workflow Status' }, type: 'select' },
    })
    expect(mappings.status?.from.field).toBe('Workflow Status')
  })

  it('matches adapter default column name case-insensitively when discovered key differs', () => {
    const mappings: Record<string, { from: { kind: 'projectV2'; field: string }; type?: 'select' }> = {
      workflow_status: { from: { kind: 'projectV2', field: 'Workflow Status' }, type: 'select' },
    }
    const seeded = seedCanonicalProjectV2FieldMapping(mappings, [
      { name: 'status', dataType: 'SINGLE_SELECT', options: [{ name: 'Open' }] },
    ], 'status')
    expect(seeded).toBe(true)
    expect(mappings.status?.from.field).toBe('status')
  })

  it('seeds priority via bootstrapFieldName case-insensitively', () => {
    const mappings: Record<string, { from: { kind: 'projectV2'; field: string }; type?: 'select' }> = {}
    const seeded = seedCanonicalProjectV2FieldMapping(mappings, fields, 'priority', undefined, {
      bootstrapFieldName: 'Priority',
    })
    expect(seeded).toBe(true)
    expect(mappings.priority?.from.field).toBe('priority')
    expect(mappings.priority?.type).toBe('select')
  })

  it('findProjectFieldNode is case-insensitive', () => {
    expect(findProjectFieldNode(fields, 'PRIORITY')?.name).toBe('priority')
  })
})
