import React, { useEffect, useMemo, useState } from 'react'
import type { DeliveryMapBundle, VertoEdge } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import ELK from 'elkjs/lib/elk.bundled.js'
import { resolveDisplayStatusGroupIndex } from '../displayStatusGroup.js'
import { statusGroupColor } from '../theme.js'
import { formatNodeStatus } from '../nodeStatusFormat.js'

const elk = new ELK()

interface NcnGraphProps {
  bundle: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  priorityOverlayActive: boolean
  highlightedSliceId?: string
  focusedNcnNodeId?: string
  onFocusNode: (id: string | undefined) => void
  onHighlightSlice: (id: string | undefined) => void
}

export function NcnGraph(props: NcnGraphProps) {
  return (
    <ReactFlowProvider>
      <NcnGraphInner {...props} />
    </ReactFlowProvider>
  )
}

function getFocusNeighbourhood(nodeId: string, edges: VertoEdge[]): Set<string> {
  const result = new Set<string>([nodeId])
  for (const e of edges) {
    if (e.to === nodeId) result.add(e.from)   // direct prereq
    if (e.from === nodeId) result.add(e.to)   // direct dependent
  }
  return result
}

function NcnGraphInner({
  bundle, displayStatusGroups,
  highlightedSliceId, focusedNcnNodeId,
  onFocusNode, onHighlightSlice,
}: NcnGraphProps) {
  const { fitView } = useReactFlow()
  const { graph } = bundle

  // Stable topology signature: ELK layout and fitView only run on structural graph changes,
  // not on priority-only bundle updates.
  const topoKey = useMemo(() => {
    const nodeIds = graph.nodes.map(n => n.id).sort().join(',')
    const edgeIds = graph.edges.map(e => `${e.from}>${e.to}`).sort().join(',')
    return `${nodeIds}|${edgeIds}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.nodes, graph.edges])

  const [elkPositions, setElkPositions] = useState<Map<string, { x: number; y: number }>>(new Map())

  useEffect(() => {
    let cancelled = false
    if (graph.nodes.length === 0) return

    const elkGraph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.layered.spacing.nodeNodeBetweenLayers': '80',
        'elk.spacing.nodeNode': '20',
      },
      children: graph.nodes.map(n => ({ id: n.id, width: 180, height: 60 })),
      edges: graph.edges.map(e => ({
        id: `${e.from}->${e.to}`,
        sources: [e.from],
        targets: [e.to],
      })),
    }

    elk.layout(elkGraph).then(layout => {
      if (cancelled) return
      setElkPositions(
        new Map((layout.children ?? []).map(c => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }])),
      )
      // fitView on every topology change (new graph, added nodes); not on data-only refreshes
      setTimeout(() => { if (!cancelled) fitView() }, 0)
    })

    return () => { cancelled = true }
  // Intentionally keyed on topology string, not full bundle — avoids ELK rerun on data-only updates
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topoKey, fitView])

  const deliverySlices = graph.nodes.filter(n => n.isDeliverySlice)

  const { rfNodes, rfEdges } = useMemo(() => {
    if (elkPositions.size === 0) return { rfNodes: [] as Node[], rfEdges: [] as Edge[] }

    const highlightedSet: Set<string> | null = highlightedSliceId
      ? new Set(
          graph.nodes
            .filter(n => bundle.servedBySliceIds?.[n.id]?.includes(highlightedSliceId))
            .map(n => n.id),
        )
      : null

    const focusSet: Set<string> | null = focusedNcnNodeId
      ? getFocusNeighbourhood(focusedNcnNodeId, graph.edges)
      : null

    function isDimmed(nodeId: string): boolean {
      if (focusSet) return !focusSet.has(nodeId)
      if (highlightedSet) return !highlightedSet.has(nodeId)
      return false
    }

    function isEdgeActive(e: VertoEdge): boolean {
      // Focus mode: only edges directly incident to the focused node are "on".
      // Edges between two neighbourhood members (prereq → sibling) stay dim,
      // matching canvas edgeState "hi" semantics.
      if (focusSet) return e.from === focusedNcnNodeId || e.to === focusedNcnNodeId
      // Highlight mode: both endpoints must be inside the highlighted closure
      if (highlightedSet) return highlightedSet.has(e.from) && highlightedSet.has(e.to)
      return true
    }

    const readySet = new Set(bundle.readyIds ?? [])

    const rfNodes: Node[] = graph.nodes.flatMap(n => {
      const pos = elkPositions.get(n.id)
      if (!pos) return []

      const isReady = readySet.has(n.id)
      const leverage = bundle.leverageScore?.[n.id] ?? 0
      const groupIdx = resolveDisplayStatusGroupIndex(n, displayStatusGroups)
      const groupColor = statusGroupColor(groupIdx)
      const dimmed = isDimmed(n.id)
      const isFocused = n.id === focusedNcnNodeId

      let border = '1px solid var(--vscode-panel-border)'
      if (isReady) border = '1.5px solid var(--vscode-charts-green)'
      if (isFocused) border = '2px solid var(--vscode-focusBorder)'

      const baseOpacity = n.isDone ? 0.4 : 1
      const opacity = dimmed ? baseOpacity * 0.25 : baseOpacity

      return [{
        id: n.id,
        position: pos,
        data: {
          title: n.title,
          statusLabel: formatNodeStatus(n, displayStatusGroups),
          isDone: n.isDone,
          groupColor,
          isReady,
          isFocused,
          leverage,
        },
        style: {
          width: 180,
          height: 60,
          border,
          opacity,
          borderRadius: 4,
          background: 'var(--vscode-editor-background)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'row' as const,
          padding: 0,
        },
        type: 'ncn',
      }]
    })

    const rfEdges: Edge[] = graph.edges.map(e => ({
      id: `${e.from}->${e.to}`,
      source: e.from,
      target: e.to,
      style: {
        stroke: 'var(--vscode-foreground)',
        opacity: isEdgeActive(e) ? 0.5 : 0.08,
      },
    }))

    return { rfNodes, rfEdges }
  }, [elkPositions, bundle, displayStatusGroups, highlightedSliceId, focusedNcnNodeId])

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    onFocusNode(node.id === focusedNcnNodeId ? undefined : node.id)
  }

  // Contextual status banner (canvas "Focused on X…" / "Highlighting closure for Y…")
  const statusBanner = focusedNcnNodeId
    ? `Focused on ${graph.nodes.find(n => n.id === focusedNcnNodeId)?.title ?? focusedNcnNodeId}`
    : highlightedSliceId
    ? `Highlighting closure for ${graph.nodes.find(n => n.id === highlightedSliceId)?.title ?? highlightedSliceId}`
    : null

  if (graph.nodes.length === 0) {
    return <div style={{ padding: 24, color: 'var(--vscode-descriptionForeground)' }}>No graph data.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 300 }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: 'var(--vscode-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
          Highlight journey:
          <select
            value={highlightedSliceId ?? ''}
            onChange={e => onHighlightSlice(e.target.value || undefined)}
            style={{
              fontSize: 12,
              background: 'var(--vscode-dropdown-background)',
              color: 'var(--vscode-dropdown-foreground)',
              border: '1px solid var(--vscode-dropdown-border)',
              borderRadius: 3,
              padding: '2px 4px',
              marginLeft: 4,
            }}
          >
            <option value="">— none —</option>
            {deliverySlices.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </label>
        {focusedNcnNodeId && (
          <button
            onClick={() => onFocusNode(undefined)}
            style={{
              fontSize: 11, padding: '2px 8px', cursor: 'pointer',
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none', borderRadius: 3,
            }}
          >
            Clear focus
          </button>
        )}
        {statusBanner && (
          <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginLeft: 4, fontStyle: 'italic' }}>
            {statusBanner}
          </span>
        )}
      </div>

      {/* ReactFlow graph canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodesDraggable={false}
          preventScrolling={false}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
        />
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NcnNode({ data }: { data: any }) {
  const { title, statusLabel, groupColor, isReady, leverage } = data as {
    title: string
    statusLabel: string
    isDone: boolean
    groupColor: string
    isReady: boolean
    isFocused: boolean
    leverage: number
  }
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div style={{ width: 4, flexShrink: 0, background: groupColor }} />
      <div style={{ flex: 1, padding: '4px 6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{
          fontSize: 11,
          color: 'var(--vscode-foreground)',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
        }}>
          {title}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <span style={{ fontSize: 9, color: 'var(--vscode-descriptionForeground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {statusLabel}
          </span>
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            {isReady && (
              <span style={{ fontSize: 9, color: 'var(--vscode-charts-green)', marginLeft: 4 }}>ready</span>
            )}
            {leverage > 0 && (
              <span style={{ fontSize: 9, color: 'var(--vscode-charts-orange)', marginLeft: 4 }}>
                ↑{leverage}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Defined outside component so ReactFlow doesn't remount nodes on every render
const nodeTypes = { ncn: NcnNode }
