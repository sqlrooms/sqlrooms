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
import {LayoutNode, isLayoutSplitNode} from '@sqlrooms/layout-config';
import {
  CSSProperties,
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {DockDirection, getDockAxis, movePanel} from './dock-layout';
import {findNearestDraggableAncestor, findNodeById} from '../layout-tree';

type PreviewMode = 'insert' | 'wrap';

type DockPreview = {
  containerStyle: CSSProperties;
  highlightStyle: CSSProperties;
  lineStyle: CSSProperties;
  mode: PreviewMode;
};

type DockingContextValue = {
  activePanelId: string | null;
  preview: DockPreview | null;
  rootLayout: LayoutNode;
};

const DockingContext = createContext<DockingContextValue | null>(null);

function getRectCenter(rect: {
  left: number;
  top: number;
  width: number;
  height: number;
}) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function getDockDirection(
  activeRect: {left: number; top: number; width: number; height: number},
  targetRect: {left: number; top: number; width: number; height: number},
): DockDirection {
  const center = getRectCenter(activeRect);
  const distances: Record<DockDirection, number> = {
    left: Math.abs(center.x - targetRect.left),
    right: Math.abs(targetRect.left + targetRect.width - center.x),
    up: Math.abs(center.y - targetRect.top),
    down: Math.abs(targetRect.top + targetRect.height - center.y),
  };

  return (Object.entries(distances).sort(([, a], [, b]) => a - b)[0]?.[0] ??
    'right') as DockDirection;
}

function getContainerElement(splitId: string | undefined): HTMLElement | null {
  if (!splitId || typeof document === 'undefined') {
    return null;
  }

  return document.querySelector<HTMLElement>(
    `[data-layout-split-id="${CSS.escape(splitId)}"]`,
  );
}

function buildPreview(
  rootLayout: LayoutNode,
  sourceId: string,
  targetId: string,
  direction: DockDirection,
  overRect: {left: number; top: number; width: number; height: number},
): DockPreview | null {
  if (sourceId === targetId) {
    return null;
  }

  const found = findNodeById(rootLayout, targetId);
  const parent = found?.ancestors[found.ancestors.length - 1];
  const axis = getDockAxis(direction);
  const sameAxisParent =
    parent && isLayoutSplitNode(parent) && parent.direction === axis
      ? parent
      : null;
  const containerRect =
    getContainerElement(sameAxisParent?.id)?.getBoundingClientRect() ??
    overRect;
  const targetLeft = overRect.left - containerRect.left;
  const targetTop = overRect.top - containerRect.top;

  let highlightStyle: CSSProperties;
  let lineStyle: CSSProperties;
  let mode: PreviewMode;

  if (sameAxisParent) {
    mode = 'insert';

    if (axis === 'row') {
      const width = overRect.width / 2;
      const left = direction === 'left' ? targetLeft : targetLeft + width;

      highlightStyle = {
        left,
        top: 0,
        width,
        height: '100%',
      };
      lineStyle = {
        left: direction === 'left' ? left + width : left,
        top: 0,
        width: 2,
        height: '100%',
      };
    } else {
      const height = overRect.height / 2;
      const top = direction === 'up' ? targetTop : targetTop + height;

      highlightStyle = {
        left: 0,
        top,
        width: '100%',
        height,
      };
      lineStyle = {
        left: 0,
        top: direction === 'up' ? top + height : top,
        width: '100%',
        height: 2,
      };
    }
  } else {
    mode = 'wrap';

    if (axis === 'row') {
      const width = overRect.width / 2;
      const left = direction === 'left' ? 0 : width;

      highlightStyle = {
        left,
        top: 0,
        width,
        height: '100%',
      };
      lineStyle = {
        left: direction === 'left' ? width : 0,
        top: 0,
        width: 2,
        height: '100%',
      };
    } else {
      const height = overRect.height / 2;
      const top = direction === 'up' ? 0 : height;

      highlightStyle = {
        left: 0,
        top,
        width: '100%',
        height,
      };
      lineStyle = {
        left: 0,
        top: direction === 'up' ? height : 0,
        width: '100%',
        height: 2,
      };
    }
  }

  return {
    containerStyle: {
      left: containerRect.left,
      top: containerRect.top,
      width: containerRect.width,
      height: containerRect.height,
    },
    highlightStyle,
    lineStyle,
    mode,
  };
}

function DockPreviewOverlay({preview}: {preview: DockPreview | null}) {
  if (!preview) {
    return null;
  }

  return (
    <div
      className="border-primary/35 bg-primary/5 pointer-events-none fixed z-50 rounded-md border"
      style={preview.containerStyle}
    >
      <div
        className="bg-primary/18 absolute rounded-sm"
        style={preview.highlightStyle}
      />
      <div className="bg-primary/60 absolute" style={preview.lineStyle} />
    </div>
  );
}

export function DockingProvider({
  rootLayout,
  onLayoutChange,
  children,
}: PropsWithChildren<{
  rootLayout: LayoutNode;
  onLayoutChange?: (layout: LayoutNode | null) => void;
}>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DockPreview | null>(null);

  const clearDragState = useCallback(() => {
    setActivePanelId(null);
    setPreview(null);
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
      const draggableAncestor = findNearestDraggableAncestor(
        rootLayout,
        targetId,
      );

      if (!draggableAncestor) {
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
      setActivePanelId(String(event.active.id));
      updatePreview(event);
    },
    [updatePreview],
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      updatePreview(event);
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
        <DockPreviewOverlay preview={preview} />
      </DndContext>
    </DockingContext.Provider>
  );
}

export function useDockingContext(): DockingContextValue {
  const context = useContext(DockingContext);

  if (!context) {
    throw new Error('useDockingContext must be used within DockingProvider');
  }

  return context;
}
