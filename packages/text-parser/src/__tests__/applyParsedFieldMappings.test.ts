import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VertoNode, VertoGraph } from '@verto/core'
import type { FieldMappings } from '@verto/config'
import { applyParsedFieldMappings, parseLabelsField, parseTextBlock } from '../applyParsedFieldMappings.js'

// ---------------------------------------------------------------------------
// Unit: parseLabelsField
// ---------------------------------------------------------------------------

describe('parseLabelsField (isArray: false)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { warnSpy.mockRestore() })

  it('single KEY:VALUE match → raw value string', () => {
    expect(parseLabelsField(['persona:engineer', 'bug'], 'persona', false)).toBe('engineer')
  })

  it('multiple KEY:VALUE → warn and take first', () => {
    const result = parseLabelsField(['persona:engineer', 'persona:designer', 'bug'], 'persona', false)
    expect(result).toBe('engineer')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('multiple'))
  })

  it('no KEY:VALUE match → null (even if bare KEY present)', () => {
    expect(parseLabelsField(['persona', 'bug'], 'persona', false)).toBeNull()
  })

  it('no match at all → null', () => {
    expect(parseLabelsField(['bug', 'feature'], 'persona', false)).toBeNull()
  })

  it('empty labels array → null', () => {
    expect(parseLabelsField([], 'persona', false)).toBeNull()
  })

  it('prefix collision — "persona2:foo" does not match "persona"', () => {
    expect(parseLabelsField(['persona2:foo'], 'persona', false)).toBeNull()
  })

  it('empty value label "persona:" → ""', () => {
    expect(parseLabelsField(['persona:'], 'persona', false)).toBe('')
  })
})

describe('parseLabelsField (isArray: true)', () => {
  it('single KEY:VALUE match → array with one string', () => {
    expect(parseLabelsField(['persona:engineer', 'bug'], 'persona', true)).toEqual(['engineer'])
  })

  it('multiple KEY:VALUE → array with all values in order', () => {
    expect(parseLabelsField(['persona:engineer', 'persona:designer', 'bug'], 'persona', true))
      .toEqual(['engineer', 'designer'])
  })

  it('bare KEY-only label → null slot in array', () => {
    expect(parseLabelsField(['persona', 'bug'], 'persona', true)).toEqual([null])
  })

  it('KEY:VALUE + bare KEY → [string, null]', () => {
    expect(parseLabelsField(['persona:admin', 'persona', 'bug'], 'persona', true))
      .toEqual(['admin', null])
  })

  it('no matches → []', () => {
    expect(parseLabelsField(['bug', 'feature'], 'persona', true)).toEqual([])
  })

  it('empty labels array → []', () => {
    expect(parseLabelsField([], 'persona', true)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Unit: parseTextBlock
// ---------------------------------------------------------------------------

describe('parseTextBlock (isArray: false)', () => {
  it('plain markers — extracts trimmed content', () => {
    expect(parseTextBlock('PHASE:BEGIN\nalpha\nPHASE:END', 'PHASE', false)).toBe('alpha')
  })

  it('HTML comment markers — extracts trimmed content', () => {
    expect(parseTextBlock('<!-- PHASE:BEGIN -->\nalpha\n<!-- PHASE:END -->', 'PHASE', false)).toBe('alpha')
  })

  it('mixed markers — BEGIN plain, END HTML comment', () => {
    expect(parseTextBlock('PHASE:BEGIN\nalpha\n<!-- PHASE:END -->', 'PHASE', false)).toBe('alpha')
  })

  it('multi-line content preserved', () => {
    expect(parseTextBlock('PHASE:BEGIN\nline one\nline two\nPHASE:END', 'PHASE', false))
      .toBe('line one\nline two')
  })

  it('block absent → null', () => {
    expect(parseTextBlock('some body without markers', 'PHASE', false)).toBeNull()
  })

  it('block empty → null', () => {
    expect(parseTextBlock('PHASE:BEGIN\n\nPHASE:END', 'PHASE', false)).toBeNull()
  })

  it('different key → null', () => {
    expect(parseTextBlock('STAGE:BEGIN\nfoo\nSTAGE:END', 'PHASE', false)).toBeNull()
  })

  it('leading/trailing whitespace in content is trimmed', () => {
    expect(parseTextBlock('PHASE:BEGIN\n  \n  hello  \n  \nPHASE:END', 'PHASE', false)).toBe('hello')
  })
})

describe('parseTextBlock (isArray: true)', () => {
  it('block present → one-element array', () => {
    expect(parseTextBlock('PHASE:BEGIN\nalpha\nPHASE:END', 'PHASE', true)).toEqual(['alpha'])
  })

  it('block absent → null (not [])', () => {
    expect(parseTextBlock('no markers', 'PHASE', true)).toBeNull()
  })

  it('block empty → null', () => {
    expect(parseTextBlock('PHASE:BEGIN\n\nPHASE:END', 'PHASE', true)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Integration: applyParsedFieldMappings
// ---------------------------------------------------------------------------

function makeNode(id: string, overrides: Partial<VertoNode> = {}): VertoNode {
  return {
    id,
    title: id,
    isDone: false,
    isDeliverySlice: false,
    priority: 5,
    prereqIds: [],
    childIds: [],
    _rawReqIds: [],
    personas: [],
    nodeType: 'ticket',
    nodeOrigin: 'test',
    ticketUrl: `https://example.com/${id}`,
    ...overrides,
  }
}

function makeGraph(nodes: VertoNode[]): VertoGraph {
  return { nodes, edges: [] }
}

describe('applyParsedFieldMappings', () => {
  it('no dot-notation entries — graph returned unchanged', () => {
    const fm: FieldMappings = { body: { from: { kind: 'issue', field: 'body' } } }
    const node = makeNode('A', { ticketFields: { body: 'hello' } })
    const g = makeGraph([node])
    expect(applyParsedFieldMappings(g, fm)).toBe(g)
  })

  it('skips parsed nodes', () => {
    const fm: FieldMappings = {
      personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true },
    }
    const node = makeNode('A', {
      nodeType: 'parsed',
      ticketFields: { labels: ['persona:engineer'] },
    })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].personas).toEqual([])
  })

  // isArray: true (canonical array field)
  it('labels.persona isArray:true — single match → canonical personas array', () => {
    const fm: FieldMappings = {
      personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true },
    }
    const node = makeNode('A', { ticketFields: { labels: ['persona:engineer', 'bug'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].personas).toEqual(['engineer'])
  })

  it('labels.persona isArray:true — multiple values → all in personas', () => {
    const fm: FieldMappings = {
      personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true },
    }
    const node = makeNode('A', { ticketFields: { labels: ['persona:engineer', 'persona:designer'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].personas).toEqual(['engineer', 'designer'])
  })

  it('labels.persona isArray:true — bare KEY → null slot preserved', () => {
    const fm: FieldMappings = {
      personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true },
    }
    const node = makeNode('A', { ticketFields: { labels: ['persona:admin', 'persona', 'bug'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].personas).toEqual(['admin', null])
  })

  it('labels.persona isArray:true — no matches → [] written to canonical', () => {
    const fm: FieldMappings = {
      personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true },
    }
    const node = makeNode('A', { ticketFields: { labels: ['bug'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].personas).toEqual([])
  })

  // isArray: false (default) — scalar
  it('labels.tier isArray:false (default) — single KEY:VALUE → scalar string', () => {
    const fm: FieldMappings = {
      tier: { from: { kind: 'issue', field: 'labels.tier' } },
    }
    const node = makeNode('A', { ticketFields: { labels: ['tier:gold'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].ticketFields!['tier']).toBe('gold')
  })

  it('labels.tier isArray:false — no match → null → field not written', () => {
    const fm: FieldMappings = {
      tier: { from: { kind: 'issue', field: 'labels.tier' } },
    }
    const node = makeNode('A', { ticketFields: { labels: ['bug'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].ticketFields?.['tier']).toBeUndefined()
  })

  // Boolean synthesis
  it('labels.backend type:boolean — label present → true written to ticketFields', () => {
    const fm: FieldMappings = {
      isBackend: { from: { kind: 'issue', field: 'labels.backend' }, type: 'boolean' },
    }
    const node = makeNode('A', { ticketFields: { labels: ['backend', 'bug'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].ticketFields!['isBackend']).toBe(true)
  })

  it('labels.backend type:boolean — label absent → false written to ticketFields', () => {
    const fm: FieldMappings = {
      isBackend: { from: { kind: 'issue', field: 'labels.backend' }, type: 'boolean' },
    }
    const node = makeNode('A', { ticketFields: { labels: ['bug'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].ticketFields!['isBackend']).toBe(false)
  })

  it('labels.backend type:boolean — label present → false on canonical root (boolean + canonical = written)', () => {
    const fm: FieldMappings = {
      isDone: { from: { kind: 'issue', field: 'labels.close' }, type: 'boolean' },
    }
    const node = makeNode('A', { ticketFields: { labels: ['close'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].isDone).toBe(true)
  })

  it('labels type:boolean — absent → false written to canonical root', () => {
    const fm: FieldMappings = {
      isDone: { from: { kind: 'issue', field: 'labels.close' }, type: 'boolean' },
    }
    const node = makeNode('A', { isDone: false, ticketFields: { labels: ['bug'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].isDone).toBe(false)
  })

  it('text-block type:boolean — block absent → null → not written (no boolean synthesis for text)', () => {
    const fm: FieldMappings = {
      isDone: { from: { kind: 'issue', field: 'body.CLOSE' }, type: 'boolean' },
    }
    const node = makeNode('A', { isDone: false, ticketFields: { body: 'no markers' } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].isDone).toBe(false)
    expect(result.nodes[0].ticketFields?.['isDone']).toBeUndefined()
  })

  // values remapping
  it('values remapping applied per-element for isArray:true', () => {
    const fm: FieldMappings = {
      tags: {
        from: { kind: 'issue', field: 'labels.tag' },
        isArray: true,
        values: { gold: 'premium', silver: 'standard' },
      },
    }
    const node = makeNode('A', { ticketFields: { labels: ['tag:gold', 'tag:silver'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].ticketFields!['tags']).toEqual(['premium', 'standard'])
  })

  it('values miss → null slot in array (not the original value)', () => {
    const fm: FieldMappings = {
      tags: {
        from: { kind: 'issue', field: 'labels.tag' },
        isArray: true,
        values: { gold: 'premium' },
      },
    }
    const node = makeNode('A', { ticketFields: { labels: ['tag:gold', 'tag:unknown'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].ticketFields!['tags']).toEqual(['premium', null])
  })

  it('null slots in isArray:true array skip values and pass through as null', () => {
    const fm: FieldMappings = {
      tags: {
        from: { kind: 'issue', field: 'labels.tag' },
        isArray: true,
        values: { gold: 'premium' },
      },
    }
    const node = makeNode('A', { ticketFields: { labels: ['tag:gold', 'tag', 'bug'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].ticketFields!['tags']).toEqual(['premium', null])
  })

  it('values applied before coerce for isArray:false', () => {
    const fm: FieldMappings = {
      tier: {
        from: { kind: 'issue', field: 'labels.tier' },
        values: { gold: 'premium' },
      },
    }
    const node = makeNode('A', { ticketFields: { labels: ['tier:gold'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].ticketFields!['tier']).toBe('premium')
  })

  // select/iteration → treated as text
  it('type:select treated as text (isArray:false → first scalar)', () => {
    const fm: FieldMappings = {
      tier: { from: { kind: 'issue', field: 'labels.tier' }, type: 'select' },
    }
    const node = makeNode('A', { ticketFields: { labels: ['tier:gold'] } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].ticketFields!['tier']).toBe('gold')
  })

  // Text-block integration
  it('body.PHASE isArray:false — extracted block written to ticketFields', () => {
    const fm: FieldMappings = {
      phase: { from: { kind: 'issue', field: 'body.PHASE' } },
    }
    const node = makeNode('A', { ticketFields: { body: 'PHASE:BEGIN\nalpha\nPHASE:END' } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].ticketFields!['phase']).toBe('alpha')
  })

  it('body.PHASE isArray:true — block present → one-element array', () => {
    const fm: FieldMappings = {
      phase: { from: { kind: 'issue', field: 'body.PHASE' }, isArray: true },
    }
    const node = makeNode('A', { ticketFields: { body: 'PHASE:BEGIN\nalpha\nPHASE:END' } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].ticketFields!['phase']).toEqual(['alpha'])
  })

  it('body.PHASE isArray:true — block absent → null → not written', () => {
    const fm: FieldMappings = {
      phase: { from: { kind: 'issue', field: 'body.PHASE' }, isArray: true },
    }
    const node = makeNode('A', { ticketFields: { body: 'no markers' } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].ticketFields?.['phase']).toBeUndefined()
  })

  it('base field absent in ticketFields — entry silently skipped', () => {
    const fm: FieldMappings = {
      personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true },
    }
    const node = makeNode('A') // no ticketFields
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].personas).toEqual([])
  })

  it('non-string/non-array base field type — entry silently skipped', () => {
    const fm: FieldMappings = {
      foo: { from: { kind: 'issue', field: 'priority.bar' } },
    }
    const node = makeNode('A', { ticketFields: { priority: 42 } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].ticketFields?.['foo']).toBeUndefined()
  })

  it('kind:projectV2 dot-notation entry — processed same as issue (no kind restriction)', () => {
    const fm: FieldMappings = {
      phase: { from: { kind: 'projectV2', field: 'body.PHASE' } },
    }
    const node = makeNode('A', { ticketFields: { body: 'PHASE:BEGIN\nbeta\nPHASE:END' } })
    const result = applyParsedFieldMappings(makeGraph([node]), fm)
    expect(result.nodes[0].ticketFields!['phase']).toBe('beta')
  })

  it('edges are preserved unchanged', () => {
    const fm: FieldMappings = {
      personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true },
    }
    const node = makeNode('A', { ticketFields: { labels: [] } })
    const edges = [{ from: 'X', to: 'A', reason: 'blocking' as const }]
    const result = applyParsedFieldMappings({ nodes: [node], edges }, fm)
    expect(result.edges).toBe(edges)
  })
})
