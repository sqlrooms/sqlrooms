import {FC, PropsWithChildren, useCallback, useMemo, useState} from 'react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {LayoutNode} from '@sqlrooms/layout-config';
import {DockingContext} from './DockingContext';
import {DockPreview} from './docking-types';
import {buildPreview, getDockDirection} from './docking-helpers';
import {movePanel} from './dock-layout';
import {findNearestDockAncestor, findNodeById} from '../layout-tree';
import {DockPreviewOverlay} from './DockPreviewOverlay';
import {DockDragOverlay} from './DockDragOverlay';

interface DockingProviderProps {
  rootLayout: LayoutNode;
  onLayoutChange?: (layout: LayoutNode | null) => void;
}

type CursorPosition = {
  x: number;
  y: number;
};

export const DockingProvider: FC<PropsWithChildren<DockingProviderProps>> = ({
  rootLayout,
  onLayoutChange,
  children,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DockPreview | null>(null);
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(
    null,
  );

  const activePanelNode = useMemo(() => {
    if (!activePanelId) return null;
    const found = findNodeById(rootLayout, activePanelId);
    return found?.node ?? null;
  }, [activePanelId, rootLayout]);

  const clearDragState = useCallback(() => {
    setActivePanelId(null);
    setPreview(null);
    setCursorPosition(null);
  }, []);

  const updatePreview = useCallback(
    (
      event: DragMoveEvent | DragStartEvent,
      cursor: {x: number; y: number} | null,
    ) => {
      const sourceId = String(event.active.id);
      const over = 'over' in event ? event.over : null;

      if (!over) {
        setPreview(null);
        return;
      }

      const targetId = String(over.id);
      const dockAncestor = findNearestDockAncestor(rootLayout, targetId);

      if (!dockAncestor) {
        setPreview(null);
        return;
      }

      if (!cursor) {
        setPreview(null);
        return;
      }

      const direction = getDockDirection(cursor, over.rect);
      setPreview(
        buildPreview(rootLayout, sourceId, targetId, direction, over.rect),
      );
    },
    [rootLayout],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const panelId = String(event.active.id);
      setActivePanelId(panelId);

      const rect = event.active.rect.current.initial;
      if (!rect) {
        return;
      }

      const cursor = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      setCursorPosition(cursor);
      updatePreview(event, cursor);
    },
    [updatePreview],
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      // Use center of translated rect as cursor position
      const rect = event.active.rect.current.translated;

      if (!rect) {
        return;
      }

      const cursor = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      setCursorPosition(cursor);
      updatePreview(event, cursor);
    },
    [updatePreview],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const sourceId = String(event.active.id);
      const over = event.over;

      if (!over || !onLayoutChange) {
        clearDragState();
        return;
      }

      const targetId = String(over.id);

      if (!cursorPosition) {
        clearDragState();
        return;
      }

      const direction = getDockDirection(cursorPosition, over.rect);
      const nextLayout = movePanel(rootLayout, sourceId, targetId, direction);

      clearDragState();

      if (nextLayout !== rootLayout) {
        onLayoutChange(nextLayout);
      }
    },
    [clearDragState, cursorPosition, onLayoutChange, rootLayout],
  );

  const value = useMemo(
    () => ({
      activePanelId,
      preview,
      rootLayout,
    }),
    [activePanelId, preview, rootLayout],
  );

  return (
    <DockingContext.Provider value={value}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={clearDragState}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activePanelId && activePanelNode && (
            <DockDragOverlay
              activePanelId={activePanelId}
              activePanelNode={activePanelNode}
            />
          )}
        </DragOverlay>
        <DockPreviewOverlay preview={preview} />
      </DndContext>
    </DockingContext.Provider>
  );
};
