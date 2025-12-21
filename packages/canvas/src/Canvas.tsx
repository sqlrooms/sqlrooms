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
import {useStoreWithCanvas} from './CanvasSlice';
import {AddNodePopover} from './nodes/AddNodePopover';
import {SqlNode} from './nodes/SqlNode';
import {VegaNode} from './nodes/VegaNode';

const nodeTypes = {
  sql: SqlNode,
  vega: VegaNode,
};

export const Canvas: React.FC = () => {
  const canvasSheet = useStoreWithCanvas((s) => {
    const sheetId =
      s.canvas.config.currentSheetId ?? s.canvas.config.sheetOrder[0];
    return sheetId ? s.canvas.config.sheets[sheetId] : undefined;
  });

  const cellsSheet = useStoreWithCanvas((s) => {
    const sheetId =
      s.canvas.config.currentSheetId ?? s.canvas.config.sheetOrder[0];
    return sheetId ? s.cells.config.sheets[sheetId] : undefined;
  });

  const cellsData = useStoreWithCanvas((s) => s.cells.config.data);

  const nodes = useMemo(() => {
    if (!canvasSheet) return [] as Node[];
    const list = canvasSheet.meta.nodeOrder
      .map((id: string) => {
        const node = canvasSheet.nodes[id];
        const cell = cellsData[id];
        if (!node || !cell) return null;
        return {
          ...node,
          type: cell.type,
          data: cell.data,
        };
      })
      .filter(Boolean);
    return list as unknown as Node[];
  }, [canvasSheet, cellsData]);

  const edges = useMemo(
    () => (cellsSheet?.edges ?? []) as Edge[],
    [cellsSheet],
  );
  const viewport = canvasSheet?.meta.viewport ?? {x: 0, y: 0, zoom: 1};
  const addEdge = useStoreWithCanvas((s) => s.canvas.addEdge);
  const applyNodeChanges = useStoreWithCanvas((s) => s.canvas.applyNodeChanges);
  const applyEdgeChanges = useStoreWithCanvas((s) => s.canvas.applyEdgeChanges);
  const setViewport = useStoreWithCanvas((s) => s.canvas.setViewport);

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
