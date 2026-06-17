import React from 'react'
import type { DeliveryMapBundle } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'
import type { NcnTableView } from '../../shared/protocol.js'
import { NcnGraph } from './NcnGraph.js'
import { ImplementationOrderTable } from './ImplementationOrderTable.js'
import { PriorityEditor } from './PriorityEditor.js'
import { FocusedNodeDetail } from './FocusedNodeDetail.js'
import {
  H1, H2, Text, Stack, Row, Grid, Stat, Divider, Callout, BorderedBox,
  StatusLegend, Spacer,
} from '../components/ui.js'
import { ncnStats } from '../bundleMetrics.js'

interface Props {
  bundle: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  projectName: string
  priorityOverlayActive: boolean
  tableView: NcnTableView
  onTableViewChange: (view: NcnTableView) => void
  highlightedSliceId?: string
  focusedNcnNodeId?: string
  onFocusNode: (id: string | undefined) => void
  onHighlightSlice: (id: string | undefined) => void
  onSetPriority: (sliceId: string, priority: number | null) => void
}

export function NcnLens({
  bundle, displayStatusGroups, projectName, priorityOverlayActive,
  tableView, onTableViewChange,
  highlightedSliceId, focusedNcnNodeId,
  onFocusNode, onHighlightSlice, onSetPriority,
}: Props) {
  const { graph } = bundle
  const stats = ncnStats(bundle)
  const deliverySlices = graph.nodes.filter(n => n.isDeliverySlice)
  const focusedNode = focusedNcnNodeId
    ? graph.nodes.find(n => n.id === focusedNcnNodeId)
    : undefined

  return (
    <Stack gap={20} style={{ padding: 24, maxWidth: 1320, margin: '0 auto' }}>
      <Stack gap={6}>
        <H1>{projectName} — Necessary Conditions Network</H1>
        <Text tone="secondary">
          The same vertical journeys, re-expressed as a dependency graph of implementable work-items. An arrow{' '}
          <Text as="span" weight="semibold">A → B</Text> means &quot;A is a necessary condition for B&quot; — so every node&apos;s
          in-arrows are its complete prerequisite set, and a node is only truly unblocked once all of them are{' '}
          <Text as="span" weight="semibold">Done</Text>. Shared subsystems appear once, so leverage and
          implementation order are visible at a glance. Read left → right as build order.
        </Text>
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat value={String(stats.nodeCount)} label="Work-items (nodes)" />
        <Stat value={`${stats.doneCount}/${stats.nodeCount}`} label="Implemented" tone="success" />
        <Stat value={String(stats.readyCount)} label="Ready to start now" tone="info" />
        <Stat value={String(stats.edgeCount)} label="Dependency edges" />
      </Grid>

      <Row
        gap={16}
        wrap
        style={{
          padding: '10px 14px',
          border: '1px solid var(--vscode-panel-border)',
          borderRadius: 8,
        }}
      >
        <Row gap={8}>
          <Text size="small" weight="semibold" tone="secondary">Highlight journey</Text>
          <select
            value={highlightedSliceId ?? ''}
            onChange={e => onHighlightSlice(e.target.value || undefined)}
            style={{
              fontSize: 12,
              background: 'var(--vscode-dropdown-background)',
              color: 'var(--vscode-dropdown-foreground)',
              border: '1px solid var(--vscode-dropdown-border)',
              borderRadius: 4,
              padding: '4px 8px',
              minWidth: 200,
            }}
          >
            <option value="">All journeys</option>
            {deliverySlices.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </Row>
        <Spacer />
        <StatusLegend displayStatusGroups={displayStatusGroups} showReadyBorder />
      </Row>

      {(focusedNode || highlightedSliceId) && (
        <Row gap={10} wrap>
          {focusedNode && (
            <Text size="small" tone="secondary">
              Focused on <Text as="span" weight="semibold">{focusedNode.title}</Text> — showing its prerequisites and dependents.
            </Text>
          )}
          {!focusedNode && highlightedSliceId && (
            <Text size="small" tone="secondary">
              Highlighting the necessary-condition closure for{' '}
              <Text as="span" weight="semibold">
                {graph.nodes.find(n => n.id === highlightedSliceId)?.title ?? highlightedSliceId}
              </Text>.
            </Text>
          )}
          {focusedNode && (
            <button
              type="button"
              onClick={() => onFocusNode(undefined)}
              style={{
                fontSize: 12,
                padding: '2px 10px',
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--vscode-textLink-foreground)',
                border: 'none',
              }}
            >
              Clear focus
            </button>
          )}
        </Row>
      )}

      <NcnGraph
        bundle={bundle}
        displayStatusGroups={displayStatusGroups}
        highlightedSliceId={highlightedSliceId}
        focusedNcnNodeId={focusedNcnNodeId}
        onFocusNode={onFocusNode}
      />

      <Text size="small" tone="quaternary">
        Tip: drag empty space to pan, scroll to zoom. Hover a node for its full prerequisites/dependents; click any node
        to focus its neighbourhood. Use the journey selector to light up everything one vertical delivery needs.
      </Text>

      {focusedNode && (
        <FocusedNodeDetail
          node={focusedNode}
          bundle={bundle}
          displayStatusGroups={displayStatusGroups}
          onFocusNode={onFocusNode}
        />
      )}

      <Divider />

      <Stack gap={10}>
        <Row gap={8} wrap>
          <Text size="small" weight="semibold" tone="secondary">Table view</Text>
          <button
            type="button"
            style={{ ...toggleBtnStyle, ...(tableView === 'implementationOrder' ? toggleBtnActiveStyle : {}) }}
            onClick={() => onTableViewChange('implementationOrder')}
          >
            Implementation order
          </button>
          <button
            type="button"
            style={{ ...toggleBtnStyle, ...(tableView === 'leverage' ? toggleBtnActiveStyle : {}) }}
            onClick={() => onTableViewChange('leverage')}
          >
            Leverage table
          </button>
        </Row>

        {tableView === 'implementationOrder' && (
          <>
            <PriorityEditor
              bundle={bundle}
              priorityOverlayActive={priorityOverlayActive}
              onSetPriority={onSetPriority}
            />

            <ImplementationOrderTable
              bundle={bundle}
              displayStatusGroups={displayStatusGroups}
              view="implementationOrder"
              focusedNodeId={focusedNcnNodeId}
              onFocusNode={onFocusNode}
            />
          </>
        )}

        {tableView === 'leverage' && (
          <ImplementationOrderTable
            bundle={bundle}
            displayStatusGroups={displayStatusGroups}
            view="leverage"
            focusedNodeId={focusedNcnNodeId}
            onFocusNode={onFocusNode}
          />
        )}
      </Stack>

      <Callout tone="info" title="How to use this for sequencing (Theory of Constraints)">
        Start from the <Text as="span" weight="semibold">Ready to start</Text> list and pick the highest-leverage items
        first — they unblock the most downstream work per unit effort. Then re-check readiness: completing a node flips
        its dependents to ready, cascading the next wave. To finish a specific journey, switch the selector to it and
        drive its closure to 100% — the highlighted nodes are exactly what remains.
      </Callout>
    </Stack>
  )
}

const toggleBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--vscode-foreground)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: 12,
  padding: '4px 12px',
  cursor: 'pointer',
  fontSize: 12,
}

const toggleBtnActiveStyle: React.CSSProperties = {
  background: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
  borderColor: 'transparent',
}
