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
import {
  H2, Text, Stack, Pill,
  DataTableFrame, dataTableStyle, dataTableThStyle, dataTableThCompactStyle,
  dataTableTdStyle, dataTableTdCompactStyle, dataTableTdWorkItemStyle, dataTableTdWrapStyle,
  dataTableRowStyle, StatusDot, dataTableColWidthForHeader,
} from '../components/ui.js'

interface Props {
  bundle: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  view: NcnTableView
  focusedNodeId?: string
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

export function ImplementationOrderTable({
  bundle, displayStatusGroups, view, focusedNodeId, onFocusNode,
}: Props) {
  const { graph } = bundle
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))

  function nodeTitle(id: string): string {
    return nodeById.get(id)?.title ?? id
  }

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
          downstream count). Add a journey priority above to turn this into a delivery execution order. Click a row
          to focus it in the graph.
        </Text>
        {readyIds.length === 0 ? (
          <Text size="small" tone="tertiary">No ready items.</Text>
        ) : (
          <DataTableFrame>
            <table style={dataTableStyle}>
              <colgroup>
                <col />
                <col style={dataTableColWidthForHeader('Current status')} />
                <col style={dataTableColWidthForHeader('Unlocks (downstream)')} />
                <col style={dataTableColWidthForHeader('Direct dependents')} />
                <col style={{ width: '26%' }} />
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
                  const serves = (bundle.servedBySliceIds?.[id] ?? [])
                    .map(sid => nodeTitle(sid))
                    .join(', ')
                  const isFocused = id === focusedNodeId
                  return (
                    <tr
                      key={id}
                      onClick={() => onFocusNode(id)}
                      style={dataTableRowStyle(isFocused)}
                    >
                      <td style={dataTableTdWorkItemStyle}>
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
                      <td style={dataTableTdStyle}>
                        <Text size="small" tone="secondary">{formatNodeStatus(node, displayStatusGroups)}</Text>
                      </td>
                      <td style={{ ...dataTableTdCompactStyle, textAlign: 'center' }}>
                        <Text weight="semibold">{String(unlocks)}</Text>
                      </td>
                      <td style={{ ...dataTableTdCompactStyle, textAlign: 'center' }}>{String(deps)}</td>
                      <td style={dataTableTdWrapStyle}>
                        <Text size="small" tone="tertiary">{serves || '—'}</Text>
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
        lifted each item. Other currently-ready items follow at the end.
      </Text>
      {orderIds.length === 0 ? (
        <Text size="small" tone="tertiary">Nothing left to do.</Text>
      ) : (
        <DataTableFrame>
          <table style={dataTableStyle}>
            <colgroup>
              <col style={indexColWidth} />
              <col style={dataTableColWidthForHeader('Priority')} />
              <col />
              <col style={dataTableColWidthForHeader('Ready now')} />
              <col style={dataTableColWidthForHeader('Status', 11)} />
              <col style={dataTableColWidthForHeader('Unlocks')} />
              <col style={{ width: '24%' }} />
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
                const serves = (bundle.servedBySliceIds?.[id] ?? [])
                  .map(sid => nodeTitle(sid))
                  .join(', ')
                const isReady = bundle.readyIds?.includes(id) ?? false
                const isFocused = id === focusedNodeId
                const hasPriority = priority !== '—'
                return (
                  <tr
                    key={id}
                    onClick={() => onFocusNode(id)}
                    style={dataTableRowStyle(isFocused)}
                  >
                    <td style={{ ...dataTableTdCompactStyle, textAlign: 'right', ...indexColPadding }}>
                      <RowIndex index={i} node={node} displayStatusGroups={displayStatusGroups} />
                    </td>
                    <td style={dataTableTdCompactStyle}>
                      {hasPriority ? (
                        <Pill size="sm" tone="warning" active title={`Priority rank ${priority}`}>
                          P{priority}
                        </Pill>
                      ) : (
                        <Text size="small" tone="quaternary">—</Text>
                      )}
                    </td>
                    <td style={dataTableTdWorkItemStyle}>
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
                    <td style={{ ...dataTableTdWrapStyle, verticalAlign: 'middle' }}>
                      <Text size="small" tone="tertiary">{serves || '—'}</Text>
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

/** Dot + up to three-digit index; extra left padding keeps content off the table edge. */
const indexColWidth: React.CSSProperties = { width: '3.5rem' }
const indexColPadding: React.CSSProperties = { paddingLeft: 8 }
