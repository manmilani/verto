import React, { useEffect, useMemo, useState } from 'react'
import type { DeliveryMapBundle, VertoEdge } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  Controls,
  ControlButton,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import { resolveDisplayStatusGroupIndex } from '../displayStatusGroup.js'
import { statusGroupColor } from '../theme.js'
import { formatNodeStatus } from '../nodeStatusFormat.js'
import {
  elkColumnOrder, dependencyDepth, packColumns, NCN_LAYOUT, type PackedLayout,
} from './ncnLayout.js'
import { usePanRegion } from '../find/panRegions.js'

const GRAPH_HEIGHT = 720
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 }

type EdgeState = 'hi' | 'on' | 'dim'
/** Later-painted edges draw on top; edges always stay under nodes. */
const EDGE_PAINT_ORDER: Record<EdgeState, number> = { dim: 0, on: 1, hi: 2 }

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
  const { graph } = bundle

  const topoKey = useMemo(() => {
    const nodeIds = graph.nodes.map(n => n.id).sort().join(',')
    const edgeIds = graph.edges.map(e => `${e.from}>${e.to}`).sort().join(',')
    return `${nodeIds}|${edgeIds}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.nodes, graph.edges])

  const [layout, setLayout] = useState<PackedLayout>()

  useEffect(() => {
    let cancelled = false
    if (graph.nodes.length === 0) return

    const nodeIds = graph.nodes.map(n => n.id)
    elkColumnOrder(nodeIds, graph.edges).then(order => {
      if (cancelled) return
      setLayout(packColumns(dependencyDepth(nodeIds, graph.edges), order, NCN_LAYOUT))
    })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topoKey])

  const { rfNodes, rfEdges } = useMemo(() => {
    if (!layout) return { rfNodes: [] as Node[], rfEdges: [] as Edge[] }

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

    function edgeState(e: VertoEdge): EdgeState {
      if (focusSet) return e.from === focusedNcnNodeId || e.to === focusedNcnNodeId ? 'hi' : 'dim'
      if (highlightedSet) return highlightedSet.has(e.from) && highlightedSet.has(e.to) ? 'on' : 'dim'
      return 'on'
    }

    const readySet = new Set(bundle.readyIds ?? [])
    const titleById = new Map(graph.nodes.map(n => [n.id, n.title]))
    const prereqTitles = new Map<string, string[]>()
    const dependentCount = new Map<string, number>()
    for (const e of graph.edges) {
      if (!titleById.has(e.from) || !titleById.has(e.to)) continue
      if (!prereqTitles.has(e.to)) prereqTitles.set(e.to, [])
      prereqTitles.get(e.to)!.push(titleById.get(e.from)!)
      dependentCount.set(e.from, (dependentCount.get(e.from) ?? 0) + 1)
    }

    const rfNodes: Node[] = graph.nodes.flatMap(n => {
      const pos = layout.positions.get(n.id)
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

      const opacity = dimmed ? 0.16 : 1
      const statusLabel = formatNodeStatus(n, displayStatusGroups)
      const prereqs = prereqTitles.get(n.id) ?? []
      const serves = (bundle.servedBySliceIds?.[n.id] ?? [])
        .filter(id => id !== n.id)
        .map(id => titleById.get(id) ?? id)
      const tooltip = [
        n.title,
        `${statusLabel} · unlocks ${leverage} downstream · ${dependentCount.get(n.id) ?? 0} direct dependents`,
        n._note,
        `Needs: ${prereqs.length ? prereqs.join(', ') : '— (foundational)'}`,
        serves.length ? `Serves: ${serves.join(', ')}` : undefined,
      ].filter(Boolean).join('\n')

      return [{
        id: n.id,
        position: pos,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          title: n.title,
          statusLabel,
          tooltip,
          groupColor,
          isReady,
          leverage,
        },
        style: {
          width: NCN_LAYOUT.nodeWidth,
          height: NCN_LAYOUT.nodeHeight,
          border,
          opacity,
          borderRadius: 8,
          background: 'var(--vscode-editorWidget-background)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'row' as const,
          padding: 0,
          cursor: 'pointer',
        },
        type: 'ncn',
      }]
    })

    const rfEdges: Edge[] = graph.edges
      .map(e => ({ e, state: edgeState(e) }))
      .sort((a, b) => EDGE_PAINT_ORDER[a.state] - EDGE_PAINT_ORDER[b.state])
      .map(({ e, state }) => {
        const hi = state === 'hi'
        const stroke = hi ? 'var(--vscode-focusBorder)' : 'var(--vscode-descriptionForeground)'
        const arrowSize = hi ? 28 : 24
        return {
          id: `${e.from}->${e.to}`,
          source: e.from,
          target: e.to,
          type: 'simplebezier',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            markerUnits: 'userSpaceOnUse',
            width: arrowSize,
            height: arrowSize,
            color: stroke,
          },
          style: {
            stroke,
            strokeWidth: hi ? 2 : 1,
            opacity: hi ? 0.95 : state === 'on' ? (highlightedSet ? 0.6 : 0.28) : 0.06,
          },
        }
      })

    return { rfNodes, rfEdges }
  }, [layout, bundle, displayStatusGroups, highlightedSliceId, focusedNcnNodeId])

  const { getViewport, setViewport } = useReactFlow()
  const panRegionRef = usePanRegion((dx, dy) => {
    const { x, y, zoom } = getViewport()
    setViewport({ x: x - dx, y: y - dy, zoom }, { duration: 200 })
  })

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
      ref={panRegionRef}
      style={{
        position: 'relative',
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: 10,
        overflow: 'hidden',
        height: GRAPH_HEIGHT,
        background: 'var(--vscode-editor-background)',
      }}
    >
      {layout && <ColumnBands layout={layout} />}
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        defaultViewport={DEFAULT_VIEWPORT}
        minZoom={0.3}
        maxZoom={2.5}
        // Plain wheel scrolls the page; Ctrl + wheel zooms (React Flow treats it as pinch-zoom).
        panOnScroll={false}
        zoomOnScroll={false}
        preventScrolling={false}
        nodeTypes={nodeTypes}
        // onlyRenderVisibleElements stays off: find (Ctrl+F) searches the text of every node.
        onNodeClick={handleNodeClick}
        proOptions={{ hideAttribution: true }}
      >
        <ZoomToolbar />
      </ReactFlow>
    </div>
  )
}

function ZoomToolbar() {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow()
  return (
    <Controls
      position="top-right"
      orientation="horizontal"
      showZoom={false}
      showFitView={false}
      showInteractive={false}
    >
      <ControlButton title="Zoom out" onClick={() => zoomOut()}>−</ControlButton>
      <ZoomReadout />
      <ControlButton title="Zoom in" onClick={() => zoomIn()}>+</ControlButton>
      <ControlButton title="Fit view" onClick={() => fitView({ padding: 0.08 })}>⤢</ControlButton>
      <ControlButton title="Reset to 100%" onClick={() => setViewport(DEFAULT_VIEWPORT)}>1:1</ControlButton>
    </Controls>
  )
}

function ZoomReadout() {
  const { zoom } = useViewport()
  return <div className="ncn-zoom-readout">{Math.round(zoom * 100)}%</div>
}

/** Alternate column shading behind the transparent React Flow pane, following pan/zoom. */
function ColumnBands({ layout }: { layout: PackedLayout }) {
  const { x, y, zoom } = useViewport()
  const { columnGap } = NCN_LAYOUT
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
        {layout.columns.map((c, i) => i % 2 === 0 && (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: c.x - columnGap / 2,
              top: 0,
              width: c.width + columnGap,
              height: layout.height,
              background: 'color-mix(in srgb, var(--vscode-foreground) 4%, transparent)',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NcnNode({ data }: { data: any }) {
  const { title, statusLabel, tooltip, groupColor, isReady, leverage } = data as {
    title: string
    statusLabel: string
    tooltip: string
    groupColor: string
    isReady: boolean
    leverage: number
  }
  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 1, height: 1 }} />
      <div className="ncn-node-body" title={tooltip} style={{ display: 'flex', width: '100%', height: '100%', cursor: 'pointer' }}>
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
          <div style={{
            fontSize: 10,
            color: 'var(--vscode-descriptionForeground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {statusLabel}
            {leverage > 0 && ` · unlocks ${leverage}`}
            {isReady && (
              <span style={{ fontWeight: 600, color: 'var(--vscode-focusBorder)' }}> · ready</span>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 1, height: 1 }} />
    </>
  )
}

const nodeTypes = { ncn: NcnNode }
