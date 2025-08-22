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
import React from 'react';
import type {CanvasNodeData} from './CanvasSlice';
import {useStoreWithCanvas} from './CanvasSlice';
import {SqlNode} from './nodes/SqlNode';
import {VegaNode} from './nodes/VegaNode';

const nodeTypes = {
  sql: SqlNode,
  vega: VegaNode,
};

export const Canvas: React.FC = () => {
  const nodes = useStoreWithCanvas(
    (s) => s.config.canvas.nodes,
  ) as unknown as Node<CanvasNodeData>[];
  const edges = useStoreWithCanvas((s) => s.config.canvas.edges) as Edge[];
  const addEdge = useStoreWithCanvas((s) => s.canvas.addEdge);
  const applyNodeChanges = useStoreWithCanvas((s) => s.canvas.applyNodeChanges);
  const applyEdgeChanges = useStoreWithCanvas((s) => s.canvas.applyEdgeChanges);
  const viewport = useStoreWithCanvas((s) => s.config.canvas.viewport);
  const setViewport = useStoreWithCanvas((s) => s.canvas.setViewport);
  const addNode = useStoreWithCanvas((s) => s.canvas.addNode);

  const empty = nodes.length === 0;

  return (
    <div className="h-full w-full">
      <div className="relative h-full w-full">
        {empty && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <button
              className="rounded-md bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
              onClick={() => addNode({})}
            >
              Add node
            </button>
          </div>
        )}
        <ReactFlow
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
    </div>
  );
};
