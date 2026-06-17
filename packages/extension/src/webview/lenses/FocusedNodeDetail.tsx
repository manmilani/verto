import React from 'react'
import type { DeliveryMapBundle, VertoNode } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'
import { formatNodeStatus } from '../nodeStatusFormat.js'
import { pillToneForNode, resolveDisplayStatusGroupIndex } from '../displayStatusGroup.js'
import { statusGroupColor } from '../theme.js'
import {
  Stack, Row, Text, Pill, BorderedBox,
} from '../components/ui.js'

interface Props {
  node: VertoNode
  bundle: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  onFocusNode: (id: string | undefined) => void
}

export function FocusedNodeDetail({ node, bundle, displayStatusGroups, onFocusNode }: Props) {
  const { graph } = bundle
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  const groupIdx = resolveDisplayStatusGroupIndex(node, displayStatusGroups)
  const barColor = statusGroupColor(groupIdx)
  const isReady = bundle.readyIds?.includes(node.id) ?? false

  const prereqs = graph.edges
    .filter(e => e.to === node.id)
    .map(e => nodeById.get(e.from))
    .filter((n): n is VertoNode => Boolean(n))

  const dependents = graph.edges
    .filter(e => e.from === node.id)
    .map(e => nodeById.get(e.to))
    .filter((n): n is VertoNode => Boolean(n))

  const servedSlices = (bundle.servedBySliceIds?.[node.id] ?? [])
    .map(sid => nodeById.get(sid))
    .filter((n): n is VertoNode => Boolean(n))

  return (
    <BorderedBox style={{ borderColor: 'var(--vscode-focusBorder)' }}>
      <Stack gap={10}>
        <Row gap={10} wrap align="flex-start">
          <div style={{ width: 5, height: 36, borderRadius: 2, background: barColor, flexShrink: 0 }} />
          <Text weight="bold" style={{ fontSize: 17, flex: 1, minWidth: 200 }}>
            {node.ticketUrl
              ? <a href={node.ticketUrl} target="_blank" rel="noreferrer" style={linkStyle}>{node.title}</a>
              : node.title}
          </Text>
          <Pill size="sm" tone={pillToneForNode(node, displayStatusGroups)} active>
            {formatNodeStatus(node, displayStatusGroups)}
          </Pill>
          <Pill size="sm" tone={isReady ? 'success' : 'neutral'}>
            {isReady ? 'Ready to start' : node.isDone ? 'Done' : 'Blocked'}
          </Pill>
          <button
            type="button"
            onClick={() => onFocusNode(undefined)}
            title="Dismiss"
            style={dismissStyle}
          >
            ×
          </button>
        </Row>

        {node._note && (
          <Text tone="secondary">{node._note}</Text>
        )}

        <Row gap={16} wrap align="flex-start">
          <Stack gap={6} style={{ flex: 1, minWidth: 200 }}>
            <Text size="small" weight="semibold" tone="tertiary">
              Necessary conditions (must be done first)
            </Text>
            {prereqs.length === 0 ? (
              <Text size="small" tone="quaternary">None — foundational work-item.</Text>
            ) : (
              <Row gap={6} wrap>
                {prereqs.map(p => (
                  <Pill
                    key={p.id}
                    size="sm"
                    tone={p.isDone ? 'success' : 'deleted'}
                    onClick={() => onFocusNode(p.id)}
                  >
                    {p.title}
                  </Pill>
                ))}
              </Row>
            )}
          </Stack>

          <Stack gap={6} style={{ flex: 1, minWidth: 200 }}>
            <Text size="small" weight="semibold" tone="tertiary">
              Unblocks directly ({dependents.length})
            </Text>
            {dependents.length === 0 ? (
              <Text size="small" tone="quaternary">Nothing depends on this — it&apos;s a delivery leaf.</Text>
            ) : (
              <Row gap={6} wrap>
                {dependents.map(d => (
                  <Pill key={d.id} size="sm" tone="neutral" onClick={() => onFocusNode(d.id)}>
                    {d.title}
                  </Pill>
                ))}
              </Row>
            )}
          </Stack>
        </Row>

        {servedSlices.length > 0 && (
          <Row gap={6} wrap align="center">
            <Text size="small" tone="tertiary" weight="semibold">Serves:</Text>
            {servedSlices.map(s => (
              <Pill key={s.id} size="sm" tone="info">{s.title}</Pill>
            ))}
          </Row>
        )}
      </Stack>
    </BorderedBox>
  )
}

const dismissStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--vscode-foreground)',
  cursor: 'pointer',
  fontSize: 18,
  padding: '0 4px',
  flexShrink: 0,
  lineHeight: 1,
}

const linkStyle: React.CSSProperties = {
  color: 'inherit',
  textDecoration: 'none',
}
