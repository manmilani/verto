import React, { useEffect, useMemo, useState } from 'react'
import type { DeliveryMapBundle, VertoEdge } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import ELK from 'elkjs/lib/elk.bundled.js'
import { resolveDisplayStatusGroupIndex } from '../displayStatusGroup.js'
import { statusGroupColor } from '../theme.js'
import { formatNodeStatus } from '../nodeStatusFormat.js'

const elk = new ELK()
const GRAPH_HEIGHT = 720

interface NcnGraphProps {
  bundle: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  highlightedSliceId?: string
  focusedNcnNodeId?: string
  onFocusNode: (id: string | undefined) => void
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
    if (e.to === nodeId) result.add(e.from)
    if (e.from === nodeId) result.add(e.to)
  }
  return result
}

function NcnGraphInner({
  bundle, displayStatusGroups,
  highlightedSliceId, focusedNcnNodeId,
  onFocusNode,
}: NcnGraphProps) {
  const { fitView } = useReactFlow()
  const { graph } = bundle

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
      children: graph.nodes.map(n => ({ id: n.id, width: 200, height: 60 })),
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
      setTimeout(() => { if (!cancelled) fitView({ padding: 0.08 }) }, 0)
    })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topoKey, fitView])

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
      if (focusSet) return e.from === focusedNcnNodeId || e.to === focusedNcnNodeId
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
      if (isReady) border = '2px solid var(--vscode-focusBorder)'
      if (isFocused) border = '2px solid var(--vscode-focusBorder)'

      const baseOpacity = n.isDone ? 0.4 : 1
      const opacity = dimmed ? baseOpacity * 0.16 : baseOpacity

      return [{
        id: n.id,
        position: pos,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          title: n.title,
          statusLabel: formatNodeStatus(n, displayStatusGroups),
          groupColor,
          isReady,
          leverage,
        },
        style: {
          width: 200,
          height: 60,
          border,
          opacity,
          borderRadius: 8,
          background: 'var(--vscode-editor-background)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'row' as const,
          padding: 0,
          cursor: 'pointer',
        },
        type: 'ncn',
      }]
    })

    const rfEdges: Edge[] = graph.edges.map(e => {
      const active = isEdgeActive(e)
      const stroke = active && focusSet
        ? 'var(--vscode-focusBorder)'
        : 'var(--vscode-foreground)'
      return {
        id: `${e.from}->${e.to}`,
        source: e.from,
        target: e.to,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: stroke,
        },
        style: {
          stroke,
          strokeWidth: active && focusSet ? 2 : 1.5,
          opacity: active ? 0.65 : 0.12,
        },
      }
    })

    return { rfNodes, rfEdges }
  }, [elkPositions, bundle, displayStatusGroups, highlightedSliceId, focusedNcnNodeId])

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    onFocusNode(node.id === focusedNcnNodeId ? undefined : node.id)
  }

  if (graph.nodes.length === 0) {
    return (
      <div style={{ padding: 24, color: 'var(--vscode-descriptionForeground)', height: GRAPH_HEIGHT }}>
        No graph data.
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: 10,
        overflow: 'hidden',
        height: GRAPH_HEIGHT,
        background: 'var(--vscode-editor-background)',
      }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll
        preventScrolling={false}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        proOptions={{ hideAttribution: true }}
      />
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NcnNode({ data }: { data: any }) {
  const { title, statusLabel, groupColor, isReady, leverage } = data as {
    title: string
    statusLabel: string
    groupColor: string
    isReady: boolean
    leverage: number
  }
  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 1, height: 1 }} />
      <div className="ncn-node-body" style={{ display: 'flex', width: '100%', height: '100%', cursor: 'pointer' }}>
        <div style={{ width: 5, flexShrink: 0, background: groupColor }} />
        <div style={{ flex: 1, padding: '6px 8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--vscode-foreground)',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            lineHeight: 1.15,
          }}>
            {title}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {statusLabel}
            </span>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {isReady && (
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--vscode-focusBorder)' }}>ready</span>
              )}
              {leverage > 0 && (
                <span style={{ fontSize: 10, color: 'var(--vscode-charts-orange)' }}>
                  · unlocks {leverage}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 1, height: 1 }} />
    </>
  )
}

const nodeTypes = { ncn: NcnNode }
