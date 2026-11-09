import React, { useRef, useState } from 'react'
import type { DeliveryMapBundle, VertoNode } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'
import type { MoveResult, NcnTableView } from '../../shared/protocol.js'
import { useEditing } from '../editing.js'
import { formatNodeStatus, formatPriority } from '../nodeStatusFormat.js'
import {
  resolveDisplayStatusGroupIndex,
  displayStatusGroupColorForNode,
} from '../displayStatusGroup.js'
import { statusGroupColor } from '../theme.js'
import { countDirectDependents } from '../bundleMetrics.js'
import { priorityTooltip } from '../priorityTooltip.js'
import { isDimmed, servedSlices } from '../focusSet.js'
import {
  H2, Text, Stack, Row, Pill,
  DataTableFrame, dataTableAutoStyle, dataTableThStyle, dataTableThCompactStyle,
  dataTableTdCompactStyle, dataTableTdWorkItemStyle, dataTableTdWrapStyle,
  dataTableRowStyle, StatusDot, dataTableShrinkColStyle, dataTableWrapMinStyle,
} from '../components/ui.js'

interface Props {
  bundle: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  view: NcnTableView
  showLosingPriorityChains: boolean
  focusedNodeId?: string
  focusSet?: Set<string>
  onFocusNode: (id: string | undefined) => void
}

function StatusGroupDot({
  node, displayStatusGroups,
}: {
  node: VertoNode
  displayStatusGroups: DisplayStatusGroup[]
}) {
  const groupIdx = resolveDisplayStatusGroupIndex(node, displayStatusGroups)
  return <StatusDot color={statusGroupColor(groupIdx)} />
}

function RowIndex({
  index, node, displayStatusGroups, grip,
}: {
  index: number
  node: VertoNode
  displayStatusGroups: DisplayStatusGroup[]
  grip?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
      {grip}
      <StatusGroupDot node={node} displayStatusGroups={displayStatusGroups} />
      <Text weight="semibold" tone="secondary">{index + 1}</Text>
    </div>
  )
}

function WorkItemPill({
  node, displayStatusGroups, isFocused, onFocus,
}: {
  node: VertoNode
  displayStatusGroups: DisplayStatusGroup[]
  isFocused: boolean
  onFocus: () => void
}) {
  return (
    <Pill
      multiline
      color={displayStatusGroupColorForNode(node, displayStatusGroups)}
      active={isFocused}
      title={node.title}
      onClick={e => { e.stopPropagation(); onFocus() }}
    >
      {node.title}
    </Pill>
  )
}

function ServesPills({
  sliceIds, nodeById, onFocusNode,
}: {
  sliceIds: string[]
  nodeById: Map<string, VertoNode>
  onFocusNode: (id: string) => void
}) {
  if (sliceIds.length === 0) return <Text size="small" tone="tertiary">—</Text>
  return (
    <Row gap={4} wrap>
      {sliceIds.map(sid => (
        <Pill
          key={sid}
          size="sm"
          tone="info"
          onClick={e => { e.stopPropagation(); onFocusNode(sid) }}
        >
          {nodeById.get(sid)?.title ?? sid}
        </Pill>
      ))}
    </Row>
  )
}

/** What the last drop did (DESIGN.md §3.5); a moved row's line hides once the row is elsewhere. */
function MoveFeedback({
  result, orderIds, nodeById, mode,
}: {
  result?: MoveResult
  orderIds: string[]
  nodeById: Map<string, VertoNode>
  mode: string
}) {
  if (!result) return null
  const { id, plan, target, error } = result
  const title = (nid: string) => <Text as="span" weight="semibold">{nodeById.get(nid)?.title ?? nid}</Text>
  let line: React.ReactNode
  if (error !== undefined || !plan || target === undefined) {
    line = <>Move not applied: {(error ?? 'no plan').replace(/^Verto: (move not applied: )?/, '')}</>
  } else if (plan.edits.length === 0) {
    line = plan.exact
      ? <>{title(id)} is already as close as its prerequisites and dependents allow.</>
      : <>{title(id)} can&apos;t move there with the priorities that can be set.</>
  } else {
    if (orderIds[plan.index] !== id) return null
    const edits = plan.edits.map((e, i) => (
      <React.Fragment key={e.nodeId}>{i > 0 && ', '}{title(e.nodeId)} P{e.from} → P{e.to}</React.Fragment>
    ))
    line = plan.exact
      ? <>Moved {title(id)} to row {plan.index + 1}: {edits} ({mode}).</>
      : <>Row {target + 1} isn&apos;t reachable for {title(id)}; moved it to row {plan.index + 1} instead: {edits} ({mode}).</>
  }
  return <Text size="small" tone="secondary">{line}</Text>
}

export function ImplementationOrderTable({
  bundle, displayStatusGroups, view, showLosingPriorityChains, focusedNodeId, focusSet, onFocusNode,
}: Props) {
  const { graph } = bundle
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  const { draft, move, moving, moveResult } = useEditing()
  const dragId = useRef<string | undefined>(undefined)
  const [drop, setDrop] = useState<{ id: string; below: boolean }>()

  if (view === 'leverage') {
    const readyIds = [...(bundle.readyIds ?? [])].sort(
      (a, b) => (bundle.leverageScore?.[b] ?? 0) - (bundle.leverageScore?.[a] ?? 0),
    )

    return (
      <Stack gap={8}>
        <H2>Ready to start now — ranked by leverage</H2>
        <Text size="small" tone="tertiary">
          Work-items whose every necessary condition is already <Text as="span" weight="semibold">Implemented</Text>,
          so work can begin immediately. Ranked by how many other work-items they ultimately unlock (transitive
          downstream count). Set journey priorities in the <Text as="span" weight="semibold">Journeys</Text> tab to
          turn this into a delivery execution order. Click a row to focus it in the graph.
        </Text>
        {readyIds.length === 0 ? (
          <Text size="small" tone="tertiary">No ready items.</Text>
        ) : (
          <DataTableFrame>
            <table style={dataTableAutoStyle}>
              <colgroup>
                <col style={workItemColWidth} />
                <col style={dataTableShrinkColStyle} />
                <col style={dataTableShrinkColStyle} />
                <col style={dataTableShrinkColStyle} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  {['Work-item', 'Current status', 'Unlocks (downstream)', 'Direct dependents', 'Serves'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        ...dataTableThStyle,
                        ...(i > 0 ? dataTableThCompactStyle : undefined),
                        ...(i === 2 || i === 3 ? { textAlign: 'center' } : undefined),
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {readyIds.map(id => {
                  const node = nodeById.get(id)
                  if (!node) return null
                  const unlocks = bundle.leverageScore?.[id] ?? 0
                  const deps = countDirectDependents(bundle, id)
                  const isFocused = id === focusedNodeId
                  return (
                    <tr
                      key={id}
                      onClick={() => onFocusNode(id)}
                      style={dataTableRowStyle(isFocused, isDimmed(focusSet, id))}
                    >
                      <td style={workItemTdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <StatusGroupDot node={node} displayStatusGroups={displayStatusGroups} />
                          <WorkItemPill
                            node={node}
                            displayStatusGroups={displayStatusGroups}
                            isFocused={isFocused}
                            onFocus={() => onFocusNode(id)}
                          />
                        </div>
                      </td>
                      <td style={dataTableTdCompactStyle}>
                        <Text size="small" tone="secondary">{formatNodeStatus(node, displayStatusGroups)}</Text>
                      </td>
                      <td style={{ ...dataTableTdCompactStyle, textAlign: 'center' }}>
                        <Text weight="semibold">{String(unlocks)}</Text>
                      </td>
                      <td style={{ ...dataTableTdCompactStyle, textAlign: 'center' }}>{String(deps)}</td>
                      <td style={servesTdStyle}>
                        <ServesPills sliceIds={servedSlices(bundle, id)} nodeById={nodeById} onFocusNode={onFocusNode} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </DataTableFrame>
        )}
      </Stack>
    )
  }

  const orderIds = (bundle.implementationOrder ?? []).filter(
    id => !nodeById.get(id)?.isDone,
  )

  const liftedCount = orderIds.filter(id => {
    const r = bundle.globalPriorityRanking?.[id]
    return r !== undefined && r < Infinity
  }).length

  const canDrag = !draft.writing && !moving
  const mode = draft.canWrite && draft.mode === 'immediate' ? 'being written to the tickets' : 'pending in the draft'
  const endDrag = () => { dragId.current = undefined; setDrop(undefined) }
  const isBelow = (e: React.DragEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return e.clientY > r.top + r.height / 2
  }
  const onRowDragOver = (e: React.DragEvent<HTMLTableRowElement>, id: string) => {
    if (dragId.current === undefined) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const below = isBelow(e)
    if (drop?.id !== id || drop.below !== below) setDrop({ id, below })
  }
  const onRowDrop = (e: React.DragEvent<HTMLTableRowElement>, i: number) => {
    const x = dragId.current
    if (x === undefined) return
    e.preventDefault()
    const after = isBelow(e) ? i : i - 1
    const from = orderIds.indexOf(x)
    endDrag()
    if (from < 0 || after === from || after === from - 1) return
    move(x, after < 0 ? undefined : orderIds[after])
  }
  const dropEdge = (id: string): React.CSSProperties | undefined =>
    drop?.id === id ? { boxShadow: `inset 0 ${drop.below ? -2 : 2}px 0 var(--vscode-focusBorder)` } : undefined

  return (
    <Stack gap={8}>
      <H2>Implementation order — to deliver your prioritised journeys fastest</H2>
      <Text size="small" tone="tertiary">
        Every not-yet-built work-item your prioritised journeys depend on ({liftedCount} in total), in an order where
        each item&apos;s prerequisites come before it. Build top-to-bottom and each journey is delivered as early as its
        priority allows. The <Text as="span" weight="semibold">Priority</Text> column shows which prioritised journey
        lifted each item. Other currently-ready items follow at the end. Journey priorities are set in the{' '}
        <Text as="span" weight="semibold">Journeys</Text> tab. Drag a row by its grip to reorder: Verto sets the
        smallest priority change that puts it there.
      </Text>
      <MoveFeedback result={moveResult} orderIds={orderIds} nodeById={nodeById} mode={mode} />
      {orderIds.length === 0 ? (
        <Text size="small" tone="tertiary">Nothing left to do.</Text>
      ) : (
        <DataTableFrame>
          <table style={dataTableAutoStyle}>
            <colgroup>
              <col style={dataTableShrinkColStyle} />
              <col style={dataTableShrinkColStyle} />
              <col style={workItemColWidth} />
              <col style={dataTableShrinkColStyle} />
              <col style={dataTableShrinkColStyle} />
              <col style={dataTableShrinkColStyle} />
              <col />
            </colgroup>
            <thead>
              <tr>
                {['#', 'Priority', 'Work-item', 'Ready now', 'Status', 'Unlocks', 'Serves'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      ...dataTableThStyle,
                      ...(i !== 2 && i !== 6 ? dataTableThCompactStyle : undefined),
                      ...(i === 0 ? { textAlign: 'right', ...indexColPadding } : undefined),
                      ...(i === 5 ? { textAlign: 'center' } : undefined),
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orderIds.map((id, i) => {
                const node = nodeById.get(id)
                if (!node) return null
                const priority = formatPriority(bundle.globalPriorityRanking?.[id])
                const unlocks = bundle.leverageScore?.[id] ?? 0
                const isReady = bundle.readyIds?.includes(id) ?? false
                const isFocused = id === focusedNodeId
                const hasPriority = priority !== '—'
                const edge = dropEdge(id)
                const grip = (
                  <span
                    draggable={canDrag}
                    title={canDrag ? 'Drag to reorder' : 'Wait for the current write or move to finish'}
                    style={{ cursor: canDrag ? 'grab' : 'default', opacity: canDrag ? 0.7 : 0.3, userSelect: 'none' }}
                    onClick={e => e.stopPropagation()}
                    onDragStart={e => {
                      dragId.current = id
                      e.dataTransfer.setData('text/plain', id)
                      e.dataTransfer.effectAllowed = 'move'
                      const row = e.currentTarget.closest('tr')
                      if (row) e.dataTransfer.setDragImage(row, 0, 0)
                    }}
                    onDragEnd={endDrag}
                  >
                    ⋮⋮
                  </span>
                )
                return (
                  <tr
                    key={id}
                    onClick={() => onFocusNode(id)}
                    onDragOver={e => onRowDragOver(e, id)}
                    onDrop={e => onRowDrop(e, i)}
                    style={dataTableRowStyle(isFocused, isDimmed(focusSet, id))}
                  >
                    <td style={{ ...dataTableTdCompactStyle, textAlign: 'right', ...indexColPadding, ...edge }}>
                      <RowIndex index={i} node={node} displayStatusGroups={displayStatusGroups} grip={grip} />
                    </td>
                    <td style={{ ...dataTableTdCompactStyle, ...edge }}>
                      {hasPriority ? (
                        <Pill
                          size="sm"
                          tone="warning"
                          active
                          title={priorityTooltip(
                            bundle.globalPriorityRanking?.[id],
                            bundle.priorityChains?.[id],
                            nodeById,
                            showLosingPriorityChains,
                          )}
                        >
                          P{priority}
                        </Pill>
                      ) : (
                        <Text size="small" tone="quaternary">—</Text>
                      )}
                    </td>
                    <td style={{ ...workItemTdStyle, ...edge }}>
                      <WorkItemPill
                        node={node}
                        displayStatusGroups={displayStatusGroups}
                        isFocused={isFocused}
                        onFocus={() => onFocusNode(id)}
                      />
                    </td>
                    <td style={{ ...dataTableTdCompactStyle, ...edge }}>
                      {isReady ? (
                        <Pill size="sm" tone="success" active>Ready</Pill>
                      ) : (
                        <Pill size="sm" tone="neutral">Blocked</Pill>
                      )}
                    </td>
                    <td style={{ ...dataTableTdCompactStyle, ...edge }}>
                      <Text size="small" tone="secondary">{formatNodeStatus(node, displayStatusGroups)}</Text>
                    </td>
                    <td style={{ ...dataTableTdCompactStyle, textAlign: 'center', ...edge }}>
                      <Text weight="semibold">{String(unlocks)}</Text>
                    </td>
                    <td style={{ ...servesTdStyle, ...edge }}>
                      <ServesPills sliceIds={servedSlices(bundle, id)} nodeById={nodeById} onFocusNode={onFocusNode} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </DataTableFrame>
      )}
    </Stack>
  )
}

const workItemColWidth: React.CSSProperties = { width: '30%' }
const workItemTdStyle: React.CSSProperties = {
  ...dataTableTdWorkItemStyle, ...dataTableWrapMinStyle, verticalAlign: 'middle',
}
const servesTdStyle: React.CSSProperties = { ...dataTableTdWrapStyle, ...dataTableWrapMinStyle }
/** Extra left padding keeps the index off the table edge. */
const indexColPadding: React.CSSProperties = { paddingLeft: 8 }
