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
import React, {useCallback, useMemo, useRef} from 'react';
import {useStoreWithCanvas} from './CanvasSlice';
import {AddNodePopover} from './nodes/AddNodePopover';
import {CanvasNodeContainer} from './nodes/CanvasNodeContainer';

export const Canvas: React.FC = () => {
  const registry = useStoreWithCanvas((s) => s.cells.cellRegistry);
  const cellData = useStoreWithCanvas((s) => s.cells.config.data);
  const nodeTypes = useMemo(() => {
    return Object.fromEntries(
      Object.entries(registry).map(([type, reg]) => [
        type,
        ({id}: {id: string}) => {
          const cell = cellData[id];
          if (!cell) return null;
          return reg.renderCell({
            id,
            cell,
            renderContainer: ({header, content, footer}) => (
              <CanvasNodeContainer id={id} headerRight={header}>
                {content}
                {footer}
              </CanvasNodeContainer>
            ),
          });
        },
      ]),
    );
  }, [registry, cellData]);

  const currentSheetId = useStoreWithCanvas(
    (s) => s.cells.config.currentSheetId,
  );
  const addSheet = useStoreWithCanvas((s) => s.cells.addSheet);

  const canvasSheet = useStoreWithCanvas((s) => {
    const sheetId = currentSheetId ?? s.cells.config.sheetOrder[0];
    return sheetId ? s.canvas.config.sheets[sheetId] : undefined;
  });

  const cellsSheet = useStoreWithCanvas((s) => {
    const sheetId = currentSheetId ?? s.cells.config.sheetOrder[0];
    return sheetId ? s.cells.config.sheets[sheetId] : undefined;
  });

  const cellsData = useStoreWithCanvas((s) => s.cells.config.data);

  const nodes = useMemo(() => {
    if (!cellsSheet) return [] as Node[];

    // Use all cells from the canonical sheet
    const list = cellsSheet.cellIds
      .map((id: string) => {
        // Get view-specific metadata if it exists
        const canvasNode = canvasSheet?.nodes[id];
        const cell = cellsData[id];
        if (!cell) return null;

        return {
          id,
          position: canvasNode?.position ?? {x: 100, y: 100},
          width: canvasNode?.width ?? 800,
          height: canvasNode?.height ?? 600,
          type: cell.type,
          data: cell.data,
        };
      })
      .filter(Boolean);
    return list as unknown as Node[];
  }, [canvasSheet, cellsSheet, cellsData]);

  const edges = useMemo(
    () => (cellsSheet?.edges ?? []) as Edge[],
    [cellsSheet],
  );
  const viewport = canvasSheet?.meta.viewport ?? {x: 0, y: 0, zoom: 1};
  const addEdge = useStoreWithCanvas((s) => s.canvas.addEdge);
  const applyNodeChanges = useStoreWithCanvas((s) => s.canvas.applyNodeChanges);
  const applyEdgeChanges = useStoreWithCanvas((s) => s.canvas.applyEdgeChanges);
  const setViewport = useStoreWithCanvas((s) => s.canvas.setViewport);

  // Debounce viewport updates to prevent rapid state saves from React Flow
  const viewportTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSetViewport = useCallback(
    (viewport: {x: number; y: number; zoom: number}) => {
      if (viewportTimeoutRef.current) {
        clearTimeout(viewportTimeoutRef.current);
      }
      viewportTimeoutRef.current = setTimeout(() => {
        setViewport(viewport);
      }, 150);
    },
    [setViewport],
  );

  const empty = nodes.length === 0;
  const {theme: colorMode} = useTheme();

  // if (!cellsSheet || cellsSheet.type !== 'canvas') {
  //   return null;
  // }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative flex-1 overflow-hidden">
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
          onViewportChange={debouncedSetViewport}
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
