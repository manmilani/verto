import type { VertoGraph } from './types.js'

export type ValidationErrorType =
  | 'cycle'
  | 'dangling_prereq'
  | 'dangling_child'
  | 'invalid_priority'
  | 'child_not_in_prereqs'
  | 'missing_ticket_url'
  | 'prereqs_consistency'
  | '_rawReqIds_integrity'

export interface ValidationIssue {
  type: ValidationErrorType
  nodeId: string
  message: string
}

export interface ValidationResult {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  /** True when there are no errors (warnings are allowed). */
  valid: boolean
}

/**
 * Validates a VertoGraph for structural integrity.
 *
 * Errors (block correct algorithm output):
 *   - cycle: directed cycle in prereqIds
 *   - dangling_prereq: prereqId references a non-existent node
 *   - dangling_child: childId references a non-existent node
 *   - invalid_priority: priority is not an integer in [1, 9]
 *   - child_not_in_prereqs: childIds is not a subset of prereqIds (specific subset of prereqs_consistency)
 *   - prereqs_consistency: prereqIds does not equal dedupe(childIds ∪ _rawReqIds ∪ blocking-edge sources)
 *   - _rawReqIds_integrity: _rawReqIds ids point at missing/non-parsed nodes, or parsed-req edges
 *     lack a matching _rawReqIds entry on the target node
 *
 * Warnings (degrade gracefully but worth surfacing):
 *   - missing_ticket_url: ticketUrl is absent on a ticket node (error); absent on a parsed node (warning)
 */
export function validateGraph(graph: VertoGraph): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const nodeIds = new Set(graph.nodes.map(n => n.id))
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))

  for (const node of graph.nodes) {
    // Dangling prereqIds
    for (const prereqId of node.prereqIds) {
      if (!nodeIds.has(prereqId)) {
        errors.push({
          type: 'dangling_prereq',
          nodeId: node.id,
          message: `prereqId "${prereqId}" references a node that does not exist in the graph`,
        })
      }
    }

    // Dangling childIds
    for (const childId of node.childIds) {
      if (!nodeIds.has(childId)) {
        errors.push({
          type: 'dangling_child',
          nodeId: node.id,
          message: `childId "${childId}" references a node that does not exist in the graph`,
        })
      }
    }

    // Priority range
    if (!Number.isInteger(node.priority) || node.priority < 1 || node.priority > 9) {
      errors.push({
        type: 'invalid_priority',
        nodeId: node.id,
        message: `priority ${node.priority} is outside the valid range [1, 9] (must be an integer)`,
      })
    }

    // childIds ⊆ prereqIds
    const prereqSet = new Set(node.prereqIds)
    for (const childId of node.childIds) {
      if (!prereqSet.has(childId)) {
        errors.push({
          type: 'child_not_in_prereqs',
          nodeId: node.id,
          message: `childId "${childId}" is not present in prereqIds — all children must be prerequisites`,
        })
      }
    }

    // ticketUrl missing: error for ticket nodes, warning for parsed nodes
    if (!node.ticketUrl) {
      const issue: ValidationIssue = {
        type: 'missing_ticket_url',
        nodeId: node.id,
        message: `node "${node.id}" has no ticketUrl — required per adapter policy (§4.6.5)`,
      }
      if (node.nodeType === 'parsed') {
        warnings.push(issue)
      } else {
        errors.push(issue)
      }
    }
  }

  // prereqs_consistency: prereqIds must equal dedupe(childIds ∪ _rawReqIds ∪ blocking-edge sources)
  // Build map of blocking-edge sources per node (reason === 'blocking' only).
  // parent-child edges are captured by childIds; parsed-req edges by _rawReqIds.
  const blockingSources = new Map<string, Set<string>>()
  for (const node of graph.nodes) blockingSources.set(node.id, new Set())
  for (const edge of graph.edges) {
    if (edge.reason === 'blocking' && blockingSources.has(edge.to)) {
      blockingSources.get(edge.to)!.add(edge.from)
    }
  }

  for (const node of graph.nodes) {
    const expected = new Set([
      ...node.childIds,
      ...node._rawReqIds,
      ...(blockingSources.get(node.id) ?? []),
    ])
    const actual = new Set(node.prereqIds)
    const inExpectedNotActual = [...expected].filter(id => !actual.has(id))
    const inActualNotExpected = [...actual].filter(id => !expected.has(id))
    if (inExpectedNotActual.length > 0 || inActualNotExpected.length > 0) {
      const parts: string[] = []
      if (inExpectedNotActual.length > 0)
        parts.push(`missing from prereqIds: ${inExpectedNotActual.map(id => `"${id}"`).join(', ')}`)
      if (inActualNotExpected.length > 0)
        parts.push(`extra in prereqIds not in childIds/_rawReqIds/blocking-edges: ${inActualNotExpected.map(id => `"${id}"`).join(', ')}`)
      errors.push({
        type: 'prereqs_consistency',
        nodeId: node.id,
        message: `node "${node.id}" prereqIds inconsistent — ${parts.join('; ')}`,
      })
    }
  }

  // _rawReqIds_integrity check 1: every id in _rawReqIds must reference a nodeType:'parsed' node
  for (const node of graph.nodes) {
    for (const parsedId of node._rawReqIds) {
      const target = nodeById.get(parsedId)
      if (!target) {
        errors.push({
          type: '_rawReqIds_integrity',
          nodeId: node.id,
          message: `_rawReqIds id "${parsedId}" on node "${node.id}" references a non-existent node`,
        })
      } else if (target.nodeType !== 'parsed') {
        errors.push({
          type: '_rawReqIds_integrity',
          nodeId: node.id,
          message: `_rawReqIds id "${parsedId}" on node "${node.id}" references a ticket node, not a parsed node`,
        })
      }
    }
  }

  // _rawReqIds_integrity check 2: every parsed-req edge must have a matching _rawReqIds entry on target
  for (const edge of graph.edges) {
    if (edge.reason !== 'parsed-req') continue
    const targetNode = nodeById.get(edge.to)
    if (!targetNode) continue // dangling_prereq already covers this
    if (!targetNode._rawReqIds.includes(edge.from)) {
      errors.push({
        type: '_rawReqIds_integrity',
        nodeId: edge.to,
        message: `parsed-req edge from "${edge.from}" to "${edge.to}" has no matching _rawReqIds entry on the target node`,
      })
    }
  }

  // Cycle detection: iterative DFS with three-colour marking
  const WHITE = 0, GREY = 1, BLACK = 2
  const colour = new Map<string, 0 | 1 | 2>()
  for (const node of graph.nodes) colour.set(node.id, WHITE)

  const reportedCycles = new Set<string>()

  // Use iterative DFS to avoid stack overflow on large graphs
  for (const startNode of graph.nodes) {
    if (colour.get(startNode.id) !== WHITE) continue

    // Stack entries: [nodeId, iterator over prereqIds, parentId | null]
    const stack: Array<{ id: string; prereqIndex: number }> = [
      { id: startNode.id, prereqIndex: 0 },
    ]
    colour.set(startNode.id, GREY)

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const node = nodeById.get(frame.id)
      const prereqs = node?.prereqIds ?? []

      if (frame.prereqIndex < prereqs.length) {
        const prereqId = prereqs[frame.prereqIndex++]
        const c = colour.get(prereqId)
        if (c === undefined) continue // dangling — already reported above
        if (c === GREY) {
          // Back edge = cycle
          if (!reportedCycles.has(prereqId)) {
            reportedCycles.add(prereqId)
            errors.push({
              type: 'cycle',
              nodeId: prereqId,
              message: `node "${prereqId}" is part of a cycle in prereqIds`,
            })
          }
        } else if (c === WHITE) {
          colour.set(prereqId, GREY)
          stack.push({ id: prereqId, prereqIndex: 0 })
        }
      } else {
        colour.set(frame.id, BLACK)
        stack.pop()
      }
    }
  }

  return { errors, warnings, valid: errors.length === 0 }
}
