import {Button, useTheme, TabStrip} from '@sqlrooms/ui';
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
import {PencilIcon, PlusIcon, TrashIcon} from 'lucide-react';
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

export const SheetsTabBar: React.FC = () => {
  const sheetOrder = useStoreWithCanvas((s) => s.cells.config.sheetOrder);
  const sheets = useStoreWithCanvas((s) => s.cells.config.sheets);
  const currentSheetId = useStoreWithCanvas(
    (s) => s.cells.config.currentSheetId,
  );

  const tabs = useMemo(
    () =>
      sheetOrder.map((id) => {
        const sheet = sheets[id];
        return {
          id,
          name: sheet?.title || 'Sheet',
        };
      }),
    [sheetOrder, sheets],
  );

  const setCurrent = useStoreWithCanvas((s) => s.cells.setCurrentSheet);
  const addSheet = useStoreWithCanvas((s) => s.cells.addSheet);
  const renameSheet = useStoreWithCanvas((s) => s.cells.renameSheet);
  const removeSheet = useStoreWithCanvas((s) => s.cells.removeSheet);

  return (
    <TabStrip
      tabs={tabs}
      openTabs={sheetOrder}
      selectedTabId={currentSheetId}
      onSelect={setCurrent}
      onCreate={() => addSheet()}
      onRename={renameSheet}
      onClose={removeSheet}
      renderTabMenu={(tab) => (
        <>
          <TabStrip.MenuItem onClick={() => renameSheet(tab.id, tab.name)}>
            <PencilIcon className="mr-2 h-4 w-4" />
            Rename
          </TabStrip.MenuItem>
          <TabStrip.MenuSeparator />
          <TabStrip.MenuItem
            variant="destructive"
            onClick={() => removeSheet(tab.id)}
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete
          </TabStrip.MenuItem>
        </>
      )}
    />
  );
};

export const Canvas: React.FC = () => {
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

  const empty = nodes.length === 0;
  const {theme: colorMode} = useTheme();

  if (!currentSheetId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">No sheets yet</p>
        <Button onClick={() => addSheet()}>Create first sheet</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <SheetsTabBar />
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
