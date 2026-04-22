import {FC, PropsWithChildren, useCallback, useMemo, useState} from 'react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragMoveEvent,
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
import {findNearestDockAncestor} from '../layout-tree';
import {usePanelTitle} from '../usePanelTitle';
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

function hasPointerCoordinates(
  event: Event,
): event is Event & {clientX: number; clientY: number} {
  return (
    'clientX' in event &&
    'clientY' in event &&
    typeof event.clientX === 'number' &&
    typeof event.clientY === 'number'
  );
}

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

  const activePanelTitle = usePanelTitle(rootLayout, activePanelId ?? '');

  const clearDragState = useCallback(() => {
    setActivePanelId(null);
    setPreview(null);
    setCursorPosition(null);
  }, []);

  const updatePreview = useCallback(
    (event: DragMoveEvent | DragStartEvent) => {
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

      const translatedRect =
        event.active.rect.current.translated ??
        event.active.rect.current.initial;

      if (!translatedRect) {
        setPreview(null);
        return;
      }

      const direction = getDockDirection(translatedRect, over.rect);
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
      updatePreview(event);

      // Track initial cursor position
      if (hasPointerCoordinates(event.activatorEvent)) {
        setCursorPosition({
          x: event.activatorEvent.clientX,
          y: event.activatorEvent.clientY,
        });
      }
    },
    [updatePreview],
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      updatePreview(event);

      // Calculate cursor position from drag delta
      const translatedRect = event.active.rect.current.translated;
      const initialRect = event.active.rect.current.initial;

      if (
        translatedRect &&
        initialRect &&
        hasPointerCoordinates(event.activatorEvent)
      ) {
        const deltaX = translatedRect.left - initialRect.left;
        const deltaY = translatedRect.top - initialRect.top;

        setCursorPosition({
          x: event.activatorEvent.clientX + deltaX,
          y: event.activatorEvent.clientY + deltaY,
        });
      }
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
      const translatedRect =
        event.active.rect.current.translated ??
        event.active.rect.current.initial;

      if (!translatedRect) {
        clearDragState();
        return;
      }

      const direction = getDockDirection(translatedRect, over.rect);
      const nextLayout = movePanel(rootLayout, sourceId, targetId, direction);

      clearDragState();

      if (nextLayout !== rootLayout) {
        onLayoutChange(nextLayout);
      }
    },
    [clearDragState, onLayoutChange, rootLayout],
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
        <DockDragOverlay
          activePanelTitle={activePanelTitle}
          cursorPosition={cursorPosition}
        />
        <DockPreviewOverlay preview={preview} />
      </DndContext>
    </DockingContext.Provider>
  );
};
