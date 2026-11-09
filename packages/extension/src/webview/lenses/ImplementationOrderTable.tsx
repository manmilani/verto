import React from 'react'
import type { DeliveryMapBundle, VertoNode } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'
import type { NcnTableView } from '../../shared/protocol.js'
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
  index, node, displayStatusGroups,
}: {
  index: number
  node: VertoNode
  displayStatusGroups: DisplayStatusGroup[]
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
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

export function ImplementationOrderTable({
  bundle, displayStatusGroups, view, showLosingPriorityChains, focusedNodeId, focusSet, onFocusNode,
}: Props) {
  const { graph } = bundle
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))

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

  return (
    <Stack gap={8}>
      <H2>Implementation order — to deliver your prioritised journeys fastest</H2>
      <Text size="small" tone="tertiary">
        Every not-yet-built work-item your prioritised journeys depend on ({liftedCount} in total), in an order where
        each item&apos;s prerequisites come before it. Build top-to-bottom and each journey is delivered as early as its
        priority allows. The <Text as="span" weight="semibold">Priority</Text> column shows which prioritised journey
        lifted each item. Other currently-ready items follow at the end. Journey priorities are set in the{' '}
        <Text as="span" weight="semibold">Journeys</Text> tab.
      </Text>
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
                return (
                  <tr
                    key={id}
                    onClick={() => onFocusNode(id)}
                    style={dataTableRowStyle(isFocused, isDimmed(focusSet, id))}
                  >
                    <td style={{ ...dataTableTdCompactStyle, textAlign: 'right', ...indexColPadding }}>
                      <RowIndex index={i} node={node} displayStatusGroups={displayStatusGroups} />
                    </td>
                    <td style={dataTableTdCompactStyle}>
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
                    <td style={workItemTdStyle}>
                      <WorkItemPill
                        node={node}
                        displayStatusGroups={displayStatusGroups}
                        isFocused={isFocused}
                        onFocus={() => onFocusNode(id)}
                      />
                    </td>
                    <td style={dataTableTdCompactStyle}>
                      {isReady ? (
                        <Pill size="sm" tone="success" active>Ready</Pill>
                      ) : (
                        <Pill size="sm" tone="neutral">Blocked</Pill>
                      )}
                    </td>
                    <td style={dataTableTdCompactStyle}>
                      <Text size="small" tone="secondary">{formatNodeStatus(node, displayStatusGroups)}</Text>
                    </td>
                    <td style={{ ...dataTableTdCompactStyle, textAlign: 'center' }}>
                      <Text weight="semibold">{String(unlocks)}</Text>
                    </td>
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

const workItemColWidth: React.CSSProperties = { width: '30%' }
const workItemTdStyle: React.CSSProperties = {
  ...dataTableTdWorkItemStyle, ...dataTableWrapMinStyle, verticalAlign: 'middle',
}
const servesTdStyle: React.CSSProperties = { ...dataTableTdWrapStyle, ...dataTableWrapMinStyle }
/** Extra left padding keeps the index off the table edge. */
const indexColPadding: React.CSSProperties = { paddingLeft: 8 }
