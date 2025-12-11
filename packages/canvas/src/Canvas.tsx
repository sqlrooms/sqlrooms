import {Button, useTheme} from '@sqlrooms/ui';
import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {PlusIcon} from 'lucide-react';
import React, {useMemo} from 'react';
import {CanvasAssistantDrawer} from './CanvasAssistantDrawer';
import type {CanvasNodeData} from './CanvasSlice';
import {useStoreWithCanvas} from './CanvasSlice';
import {AddNodePopover} from './nodes/AddNodePopover';
import {SqlNode} from './nodes/SqlNode';
import {VegaNode} from './nodes/VegaNode';

const nodeTypes = {
  sql: SqlNode,
  vega: VegaNode,
};

export const Canvas: React.FC = () => {
  const dag = useStoreWithCanvas((s) => {
    const dagId = s.canvas.config.currentDagId ?? s.canvas.config.dagOrder[0];
    return dagId ? s.canvas.config.dags[dagId] : undefined;
  });

  const nodes = useMemo(() => {
    if (!dag) return [] as Node<CanvasNodeData>[];
    const list = dag.meta.nodeOrder.length
      ? dag.meta.nodeOrder.map((id: string) => dag.cells[id]).filter(Boolean)
      : Object.values(dag.cells);
    return list as unknown as Node<CanvasNodeData>[];
  }, [dag]);

  const edges = useMemo(() => (dag?.meta.edges ?? []) as Edge[], [dag]);
  const viewport = dag?.meta.viewport ?? {x: 0, y: 0, zoom: 1};
  const addEdge = useStoreWithCanvas((s) => s.canvas.addEdge);
  const applyNodeChanges = useStoreWithCanvas((s) => s.canvas.applyNodeChanges);
  const applyEdgeChanges = useStoreWithCanvas((s) => s.canvas.applyEdgeChanges);
  const setViewport = useStoreWithCanvas((s) => s.canvas.setViewport);
  const addNode = useStoreWithCanvas((s) => s.canvas.addNode);

  const empty = nodes.length === 0;
  const {theme: colorMode} = useTheme();

  return (
    <div className="h-full w-full">
      <div className="relative h-full w-full">
        {empty && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <AddNodePopover>
              <Button size="xs">
                <PlusIcon className="h-4 w-4" />
                Add node
              </Button>
            </AddNodePopover>
          </div>
        )}
        <ReactFlow
          minZoom={0.1}
          colorMode={colorMode}
          nodes={nodes as any}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={applyNodeChanges}
          onEdgesChange={applyEdgeChanges}
          onViewportChange={setViewport}
          onConnect={addEdge}
          viewport={viewport}
          // fitView
        >
          <MiniMap />
          <Controls position="top-left" />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
      </div>
      <CanvasAssistantDrawer />
    </div>
  );
};
