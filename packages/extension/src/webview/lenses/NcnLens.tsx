import React, { useMemo } from 'react'
import type { DeliveryMapBundle } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'
import type { NcnTableView } from '../../shared/protocol.js'
import { NcnGraph } from './NcnGraph.js'
import { ImplementationOrderTable } from './ImplementationOrderTable.js'
import { FocusedNodeDetail } from './FocusedNodeDetail.js'
import { focusSet } from '../focusSet.js'
import {
  H1, H2, Text, Stack, Row, Grid, Stat, Divider, Callout, BorderedBox,
  StatusLegend, Spacer, Pill,
} from '../components/ui.js'
import { ncnStats } from '../bundleMetrics.js'

interface Props {
  bundle: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  showOthersColumn: boolean
  displayStatusGroupTooltips: Record<string, string>
  projectName: string
  tableView: NcnTableView
  onTableViewChange: (view: NcnTableView) => void
  showLosingPriorityChains: boolean
  focusedNcnNodeId?: string
  onFocusNode: (id: string | undefined) => void
}

export function NcnLens({
  bundle, displayStatusGroups, showOthersColumn, displayStatusGroupTooltips, projectName,
  tableView, onTableViewChange, showLosingPriorityChains,
  focusedNcnNodeId, onFocusNode,
}: Props) {
  const { graph } = bundle
  const stats = ncnStats(bundle)
  const deliverySlices = graph.nodes.filter(n => n.isDeliverySlice)
  const focusedNode = focusedNcnNodeId
    ? graph.nodes.find(n => n.id === focusedNcnNodeId)
    : undefined
  const emphasis = useMemo(() => focusSet(graph, focusedNcnNodeId), [graph, focusedNcnNodeId])

  const showOtherLegend = showOthersColumn

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
          <Text size="small" weight="semibold" tone="secondary">Focus journey</Text>
          <select
            value={focusedNode?.isDeliverySlice ? focusedNode.id : ''}
            onChange={e => onFocusNode(e.target.value || undefined)}
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
            <option value="">—</option>
            {deliverySlices.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </Row>
        <Spacer />
        <StatusLegend
          displayStatusGroups={displayStatusGroups}
          displayStatusGroupTooltips={displayStatusGroupTooltips}
          showOther={showOtherLegend}
          showReadyBorder
        />
      </Row>

      {focusedNode && (
        <Row gap={10} wrap>
          <Text size="small" tone="secondary">
            Focused on <Text as="span" weight="semibold">{focusedNode.title}</Text> — showing everything it needs and
            what it unblocks next.
          </Text>
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
        </Row>
      )}

      <NcnGraph
        bundle={bundle}
        displayStatusGroups={displayStatusGroups}
        focusedNcnNodeId={focusedNcnNodeId}
        focusSet={emphasis}
        onFocusNode={onFocusNode}
      />

      <Text size="small" tone="quaternary">
        Tip: drag empty space to pan, Ctrl + mouse-wheel to zoom (or use the toolbar; 1:1 resets to 100%).
        Hover a node for its prerequisites and the journeys it serves; click any node — or a journey anywhere — to
        focus it: the graph and tables dim everything except what it needs and what it unblocks next. Ctrl+F finds
        text anywhere in the panel.
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
          <Pill
            active={tableView === 'implementationOrder'}
            onClick={() => onTableViewChange('implementationOrder')}
          >
            Implementation order
          </Pill>
          <Pill
            active={tableView === 'leverage'}
            onClick={() => onTableViewChange('leverage')}
          >
            Leverage table
          </Pill>
        </Row>

        <ImplementationOrderTable
          bundle={bundle}
          displayStatusGroups={displayStatusGroups}
          view={tableView}
          showLosingPriorityChains={showLosingPriorityChains}
          focusedNodeId={focusedNcnNodeId}
          focusSet={emphasis}
          onFocusNode={onFocusNode}
        />
      </Stack>

      <Callout tone="info" title="How to use this for sequencing (Theory of Constraints)">
        Start from the <Text as="span" weight="semibold">Ready to start</Text> list and pick the highest-leverage items
        first — they unblock the most downstream work per unit effort. Then re-check readiness: completing a node flips
        its dependents to ready, cascading the next wave. To finish a specific journey, focus it (selector or any
        journey pill) and drive its closure to 100% — the emphasised nodes are exactly what remains.
      </Callout>
    </Stack>
  )
}
