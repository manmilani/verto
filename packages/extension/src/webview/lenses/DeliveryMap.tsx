import React, { useMemo } from 'react'
import type { DeliveryMapBundle, VertoNode } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'
import { buildPipelineForSlice } from '../pipelineRows.js'
import {
  resolveDisplayStatusGroupIndex,
  isGap, groupLabelsWithOther, OTHER_DISPLAY_STATUS_GROUP,
  countByDisplayStatusGroup, weightByDisplayStatusGroup, formatDisplayGroupCounts,
  pillToneForNode, formatDisplayGroupsProse,
} from '../displayStatusGroup.js'
import { statusGroupColor } from '../theme.js'
import { formatNodeStatus } from '../nodeStatusFormat.js'
import { deliveryMapStats } from '../bundleMetrics.js'
import {
  H1, H2, Text, Stack, Row, Grid, Stat, Divider, Callout, BorderedBox,
  StatusLegend, Spacer, Pill, buildTone, pct, rowToneFor,
  DataTableFrame, dataTableStyle, dataTableThStyle, dataTableThCompactStyle,
  dataTableTdStyle, dataTableTdCompactStyle, dataTableTdWorkItemStyle, dataTableTdWrapStyle,
  dataTableRowStyle, StatusDot, completionDotColor, dataTableColWidthForHeader,
} from '../components/ui.js'

interface Props {
  bundle: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  projectName: string
  focusedNode: string | undefined
  setFocusedNode: (id: string | undefined) => void
  onHighlightSlice?: (sliceId: string | undefined) => void
}

export function DeliveryMap({
  bundle, displayStatusGroups, projectName, focusedNode, setFocusedNode, onHighlightSlice,
}: Props) {
  const { graph } = bundle
  const implOrder = bundle.implementationOrder ?? []
  const allGroups = useMemo(
    () => groupLabelsWithOther(displayStatusGroups),
    [displayStatusGroups],
  )

  const slices = useMemo(
    () => [...graph.nodes.filter(n => n.isDeliverySlice)].sort(
      (a, b) =>
        (bundle.deliveryCompleteness?.[b.id] ?? 0) -
        (bundle.deliveryCompleteness?.[a.id] ?? 0),
    ),
    [graph.nodes, bundle.deliveryCompleteness],
  )

  const pipelinesBySliceId = useMemo(() => {
    const map = new Map<string, VertoNode[]>()
    for (const n of graph.nodes) {
      if (n.isDeliverySlice) {
        map.set(n.id, buildPipelineForSlice(n.id, graph, implOrder))
      }
    }
    return map
  }, [graph, implOrder])

  const dmStats = useMemo(
    () => deliveryMapStats(bundle, displayStatusGroups, pipelinesBySliceId),
    [bundle, displayStatusGroups, pipelinesBySliceId],
  )

  const activeSliceId = useMemo(() => {
    if (slices.length === 0) return undefined
    if (focusedNode && slices.some(s => s.id === focusedNode)) return focusedNode
    return slices[0].id
  }, [slices, focusedNode])

  const pipeline = useMemo(
    () => (activeSliceId ? pipelinesBySliceId.get(activeSliceId) ?? [] : []),
    [activeSliceId, pipelinesBySliceId],
  )

  const gaps = useMemo(
    () => pipeline.filter(row => isGap(row, displayStatusGroups)),
    [pipeline, displayStatusGroups],
  )

  if (slices.length === 0) {
    return (
      <div style={{ padding: 24, color: 'var(--vscode-descriptionForeground)' }}>
        No delivery slices found.
      </div>
    )
  }

  const slice = slices.find(s => s.id === activeSliceId) ?? slices[0]
  const scomp = bundle.deliveryCompleteness?.[slice.id] ?? 0

  const solidSlices = slices.filter(s => (bundle.deliveryCompleteness?.[s.id] ?? 0) >= 0.7)

  return (
    <Stack gap={20} style={{ padding: 24, maxWidth: 1180, margin: '0 auto' }}>
      <Stack gap={6}>
        <H1>{projectName} — Vertical Delivery Map</H1>
        <Text tone="secondary">
          Vertical user journeys for {projectName}, realised through a stack of subsystems; the colour of every step
          shows whether it is {formatDisplayGroupsProse(displayStatusGroups)}. Pick a journey to walk its
          delivery pipeline and see exactly what is missing.
        </Text>
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat value={String(dmStats.sliceCount)} label="Vertical journeys mapped" />
        <Stat
          value={pct(dmStats.overall)}
          label="Weighted build coverage"
          tone={dmStats.overall >= 0.5 ? 'success' : 'warning'}
        />
        <Stat
          value={`${dmStats.built70}/${dmStats.sliceCount}`}
          label="Journeys ≥70% built"
          tone="info"
        />
        <Stat value={String(dmStats.gapCount)} label="Gap steps (unsatisfied)" tone="danger" />
      </Grid>

      <Row
        gap={20}
        wrap
        style={{
          padding: '10px 14px',
          border: '1px solid var(--vscode-panel-border)',
          borderRadius: 8,
        }}
      >
        <Text size="small" weight="semibold" tone="secondary">Legend</Text>
        <StatusLegend displayStatusGroups={displayStatusGroups} />
        <Spacer />
        <Text size="small" tone="quaternary">Live data from your tracker</Text>
      </Row>

      <Stack gap={8}>
        <H2>Explore a vertical delivery</H2>
        <Row gap={8} wrap>
          {slices.map(s => {
            const c = bundle.deliveryCompleteness?.[s.id] ?? 0
            return (
              <Pill
                key={s.id}
                active={s.id === slice.id}
                tone={buildTone(c)}
                onClick={() => { setFocusedNode(s.id); onHighlightSlice?.(s.id) }}
                title={`${pct(c)} built`}
              >
                {s.title}
              </Pill>
            )
          })}
        </Row>
      </Stack>

      <BorderedBox>
        <Stack gap={12}>
          <Row gap={12} wrap align="flex-start">
            <Stack gap={2} style={{ flex: 1, minWidth: 240 }}>
              <Text weight="bold" style={{ fontSize: 18 }}>{slice.title}</Text>
              {slice.personas && slice.personas.length > 0 && (
                <Text size="small" tone="tertiary">{slice.personas.join(', ')}</Text>
              )}
            </Stack>
            <Stat
              value={pct(scomp)}
              label="Journey build"
              tone={rowToneFor(scomp) === 'danger' ? 'danger' : rowToneFor(scomp)}
            />
          </Row>

          {slice._outcome && (
            <Text italic tone="secondary">{slice._outcome}</Text>
          )}

          <UsageBar pipeline={pipeline} displayStatusGroups={displayStatusGroups} />

          <Divider />

          <Text size="small" tone="secondary" weight="semibold">
            Delivery pipeline — how this journey is (or would be) realised, top to bottom
          </Text>
          <Stack gap={0}>
            {pipeline.length === 0 ? (
              <Text size="small" tone="tertiary">No pipeline items.</Text>
            ) : (
              pipeline.map((row, i) => (
                <PipelineStep
                  key={row.id}
                  row={row}
                  index={i}
                  last={i === pipeline.length - 1}
                  displayStatusGroups={displayStatusGroups}
                />
              ))
            )}
          </Stack>

          {gaps.length > 0 && (
            <Callout
              tone="danger"
              title={`What's missing to fully deliver "${slice.title}" (${gaps.length} of ${pipeline.length} steps)`}
            >
              <Stack gap={4}>
                {gaps.map(g => (
                  <Text key={g.id} size="small">
                    <Text as="span" weight="semibold">{formatNodeStatus(g, displayStatusGroups)}:</Text>{' '}
                    {g.title}
                  </Text>
                ))}
              </Stack>
            </Callout>
          )}
        </Stack>
      </BorderedBox>

      <Divider />

      <Stack gap={8}>
        <H2>Full portfolio at a glance</H2>
        <Text size="small" tone="tertiary">
          All vertical deliveries ranked by build coverage. Click a journey to open its pipeline above. Counts are
          subsystem steps per status.
        </Text>
        <DataTableFrame>
          <table style={dataTableStyle}>
            <colgroup>
              <col />
              <col style={dataTableColWidthForHeader('Primary user', 8)} />
              <col style={dataTableColWidthForHeader('Build')} />
              {allGroups.map(col => (
                <col key={col} style={dataTableColWidthForHeader(col)} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {['Vertical delivery', 'Primary user', 'Build', ...allGroups].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      ...dataTableThStyle,
                      ...(i > 1 ? dataTableThCompactStyle : undefined),
                      ...(i > 1 ? { textAlign: 'right' } : undefined),
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slices.map(s => {
                const rows = pipelinesBySliceId.get(s.id) ?? []
                const counts = countByDisplayStatusGroup(rows, displayStatusGroups)
                const comp = bundle.deliveryCompleteness?.[s.id] ?? 0
                const isSelected = s.id === slice.id
                const primaryUser = s.personas.length > 0 ? s.personas.join(' / ') : '—'
                return (
                  <tr
                    key={s.id}
                    onClick={() => { setFocusedNode(s.id); onHighlightSlice?.(s.id) }}
                    style={dataTableRowStyle(isSelected)}
                  >
                    <td style={dataTableTdWorkItemStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <StatusDot color={completionDotColor(comp)} />
                        <Pill
                          active={isSelected}
                          tone={buildTone(comp)}
                          onClick={e => {
                            e.stopPropagation()
                            setFocusedNode(s.id)
                            onHighlightSlice?.(s.id)
                          }}
                        >
                          {s.title}
                        </Pill>
                      </div>
                    </td>
                    <td style={dataTableTdWrapStyle}>
                      <Text size="small" tone="secondary">{primaryUser}</Text>
                    </td>
                    <td style={{ ...dataTableTdCompactStyle, textAlign: 'right' }}>
                      <Text weight="semibold">{pct(comp)}</Text>
                    </td>
                    {allGroups.map(col => (
                      <td key={col} style={{ ...dataTableTdCompactStyle, textAlign: 'right' }}>
                        {counts[col] ?? 0}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </DataTableFrame>
      </Stack>

      {solidSlices.length > 0 && (
        <Callout tone="success" title="What is genuinely solid today">
          <Stack gap={4}>
            {solidSlices.map(s => (
              <Text key={s.id} size="small">
                <Text as="span" weight="semibold">{s.title}</Text> — {pct(bundle.deliveryCompleteness?.[s.id] ?? 0)} built
              </Text>
            ))}
          </Stack>
        </Callout>
      )}
    </Stack>
  )
}

function PipelineStep({
  row, index, last, displayStatusGroups,
}: {
  row: VertoNode
  index: number
  last: boolean
  displayStatusGroups: DisplayStatusGroup[]
}) {
  const groupIdx = resolveDisplayStatusGroupIndex(row, displayStatusGroups)
  const dotColor = statusGroupColor(groupIdx)
  const isMissing = isGap(row, displayStatusGroups)

  return (
    <Row gap={12} align="stretch">
      <div style={{ position: 'relative', width: 26, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {!last && (
          <div
            style={{
              position: 'absolute',
              top: 18,
              bottom: -14,
              width: 2,
              background: 'var(--vscode-panel-border)',
            }}
          />
        )}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            marginTop: 8,
            width: 20,
            height: 20,
            borderRadius: 999,
            background: dotColor,
            color: 'var(--vscode-editor-background)',
            fontSize: 11,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--vscode-editor-background)',
          }}
        >
          {index + 1}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          border: '1px solid var(--vscode-panel-border)',
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 6,
          background: isMissing ? 'var(--vscode-input-background)' : 'transparent',
        }}
      >
        <Row gap={8} align="center">
          <Text weight="semibold" style={{ flex: 1, minWidth: 0 }}>{row.title}</Text>
          <Pill size="sm" tone={pillToneForNode(row, displayStatusGroups)} active>
            {formatNodeStatus(row, displayStatusGroups)}
          </Pill>
        </Row>
        {row._note && (
          <Text size="small" tone="tertiary" style={{ marginTop: 2 }}>{row._note}</Text>
        )}
      </div>
    </Row>
  )
}

function UsageBar({ pipeline, displayStatusGroups }: {
  pipeline: VertoNode[]
  displayStatusGroups: DisplayStatusGroup[]
}) {
  const allGroups = groupLabelsWithOther(displayStatusGroups)
  const weights = weightByDisplayStatusGroup(pipeline, displayStatusGroups)
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  const weightSummary = formatDisplayGroupCounts(weights, displayStatusGroups)

  return (
    <div>
      <Row gap={8} style={{ marginBottom: 4 }}>
        <Text size="small" tone="secondary" weight="semibold" style={{ flex: 1 }}>Subsystem build mix</Text>
        {weightSummary && (
          <Text size="small" tone="tertiary">{weightSummary}</Text>
        )}
      </Row>
      <div style={{ display: 'flex', height: 12, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
        {allGroups.map(col => {
          const w = weights[col]
          if (w === 0) return null
          const groupIdx = col === OTHER_DISPLAY_STATUS_GROUP
            ? -1
            : displayStatusGroups.findIndex(g => g.label === col)
          return (
            <div
              key={col}
              title={`${col}: ${w}`}
              style={{ flex: w / total, background: statusGroupColor(groupIdx), minWidth: 2 }}
            />
          )
        })}
      </div>
      <Row gap={12} wrap style={{ marginTop: 4 }}>
        {allGroups.map(col => {
          const w = weights[col]
          if (w === 0) return null
          const groupIdx = col === OTHER_DISPLAY_STATUS_GROUP
            ? -1
            : displayStatusGroups.findIndex(g => g.label === col)
          return (
            <Row key={col} gap={4}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: statusGroupColor(groupIdx) }} />
              <Text size="small" tone="tertiary">{col}</Text>
            </Row>
          )
        })}
      </Row>
    </div>
  )
}
