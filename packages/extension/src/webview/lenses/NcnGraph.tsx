import React, { useEffect, useState } from 'react'
import type { DeliveryMapBundle } from '@verto/core'
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react'
import ELK from 'elkjs/lib/elk.bundled.js'
import { statusColor, statusLabel } from '../theme.js'

const elk = new ELK()

interface Props {
  bundle: DeliveryMapBundle
}

export function NcnGraph({ bundle }: Props) {
  return (
    <ReactFlowProvider>
      <NcnGraphInner bundle={bundle} />
    </ReactFlowProvider>
  )
}

function NcnGraphInner({ bundle }: Props) {
  const { fitView } = useReactFlow()
  const [rfNodes, setRfNodes] = useState<Node[]>([])
  const [rfEdges, setRfEdges] = useState<Edge[]>([])

  useEffect(() => {
    let cancelled = false
    const { graph } = bundle
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
      const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))
      const readySet = new Set(bundle.readyIds ?? [])

      const nodes: Node[] = (layout.children ?? []).flatMap(child => {
        const n = nodeMap.get(child.id)
        if (!n) return []
        const isReady = readySet.has(child.id)
        const leverage = bundle.leverageScore?.[child.id] ?? 0

        let border = '1px solid var(--vscode-foreground)'
        let opacity = 1
        if (isReady) border = '2px solid var(--vscode-charts-green)'
        if (n.isDone) opacity = 0.4

        return [{
          id: child.id,
          position: { x: child.x ?? 0, y: child.y ?? 0 },
          data: { n, leverage, isReady },
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
          type: 'default',
        }]
      })

      const edges: Edge[] = graph.edges.map(e => ({
        id: `${e.from}->${e.to}`,
        source: e.from,
        target: e.to,
        style: { stroke: 'var(--vscode-foreground)', opacity: 0.4 },
      }))

      setRfNodes(nodes)
      setRfEdges(edges)
      setTimeout(() => { if (!cancelled) fitView() }, 0)
    })

    return () => { cancelled = true }
  }, [bundle, fitView])

  const { graph } = bundle
  if (graph.nodes.length === 0) {
    return <div style={{ padding: 24, color: 'var(--vscode-descriptionForeground)' }}>No graph data.</div>
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 400 }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodesDraggable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        nodeTypes={{ default: NcnNode }}
      />
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NcnNode({ data }: { data: any }) {
  const { n, leverage, isReady } = data as {
    n: { title: string; status?: string; isDone: boolean }
    leverage: number
    isReady: boolean
  }
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div style={{ width: 4, flexShrink: 0, background: statusColor(n.status) }} />
      <div style={{ flex: 1, padding: '4px 6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{
          fontSize: 11,
          color: 'var(--vscode-foreground)',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
        }}>
          {n.title}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <span style={{ fontSize: 9, color: 'var(--vscode-descriptionForeground)' }}>
            {statusLabel(n.status)}
          </span>
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
  )
}
