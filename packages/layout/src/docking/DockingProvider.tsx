import {FC, PropsWithChildren, useCallback, useMemo, useState} from 'react';
import {
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  useDndMonitor,
} from '@dnd-kit/core';
import {LayoutNode} from '@sqlrooms/layout-config';
import {DockingContext} from './DockingContext';
import {DockPreview} from './docking-types';
import {buildPreview, getDockDirection} from './docking-helpers';
import {movePanel} from './dock-layout';
import {findNearestDockAncestor, findNodeById} from '../layout-tree';
import {DockPreviewOverlay} from './DockPreviewOverlay';
import {DockDragOverlay} from './DockDragOverlay';
import {LAYOUT_PANEL_DND_KIND} from '../node-renderers/leaf-node-renderer/LeafLayoutPanel';

interface DockingProviderProps {
  rootLayout: LayoutNode;
  onLayoutChange?: (layout: LayoutNode | null) => void;
}

type CursorPosition = {
  x: number;
  y: number;
};

/**
 * Provides layout panel docking inside a dnd-kit `DndContext`.
 *
 * `LayoutRenderer` wraps `DockingProvider` with `RoomDndProvider` by default.
 * Custom shells that render `DockingProvider` directly must provide their own
 * `DndContext`/`RoomDndProvider`; dnd-kit's `useDndMonitor` surfaces the
 * development-time error if this requirement is missed.
 */
export const DockingProvider: FC<PropsWithChildren<DockingProviderProps>> = ({
  rootLayout,
  onLayoutChange,
  children,
}) => {
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

  const isLayoutPanelDrag = useCallback((event: DragStartEvent) => {
    return event.active.data.current?.kind === LAYOUT_PANEL_DND_KIND;
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!isLayoutPanelDrag(event)) return;
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
    [isLayoutPanelDrag, updatePreview],
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (!activePanelId) return;
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
    [activePanelId, updatePreview],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!activePanelId) return;
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
    [activePanelId, clearDragState, cursorPosition, onLayoutChange, rootLayout],
  );

  useDndMonitor({
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onDragCancel: clearDragState,
  });

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
    </DockingContext.Provider>
  );
};
