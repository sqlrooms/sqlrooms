import {
  LayoutGridItem,
  LayoutGridNode,
  LayoutNode,
  isLayoutGridNode,
  isLayoutNodeKey,
} from '@sqlrooms/layout-config';
import {FC, Ref, useCallback, useMemo} from 'react';
import {Responsive, WidthProvider} from 'react-grid-layout';
import {LayoutNodeProvider} from '../../LayoutNodeContext';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {ParentDirection} from '../../layout-base-types';
import {findNodeById} from '../../layout-tree';
import {LayoutPath} from '../../types';
import {useRenderNode} from '../RenderNodeContext';
import {RendererSwitcher} from '../RendererSwitcher';
import {useGetPanel} from '../../useGetPanel';
import {useScrollNewGridChildIntoView} from './useScrollNewGridChildIntoView';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const DEFAULT_BREAKPOINTS = {lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0};
const DEFAULT_COLS = {lg: 12, md: 10, sm: 6, xs: 4, xxs: 2};
const DEFAULT_RESIZE_HANDLES: NonNullable<LayoutGridNode['resizeHandles']> = [
  'n',
  'e',
  's',
  'w',
  'se',
  'sw',
];
const GRID_LAYOUT_STYLES = `
.sqlrooms-grid-layout .react-grid-item {
  overflow: visible;
  transition: none;
}

.sqlrooms-grid-layout .react-grid-item.react-draggable-dragging {
  opacity: 1;
}

.sqlrooms-grid-layout .react-grid-item.react-grid-placeholder {
  background: hsl(var(--primary) / 0.18);
  border: 1px solid hsl(var(--primary) / 0.35);
  opacity: 1;
  transition: none;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle {
  background-image: none;
  box-sizing: border-box;
  opacity: 0;
  padding: 0;
  transform: none;
  transition:
    background-color 120ms ease,
    opacity 120ms ease;
  z-index: 20;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle::after {
  content: none;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle:hover,
.sqlrooms-grid-layout .react-grid-item.resizing > .sqlrooms-grid-resize-handle {
  opacity: 1;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-e {
  bottom: 0;
  cursor: ew-resize;
  height: 100%;
  margin-top: 0;
  right: -4px;
  top: 0;
  width: 12px;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-w {
  bottom: 0;
  cursor: ew-resize;
  height: 100%;
  left: -4px;
  margin-top: 0;
  top: 0;
  width: 12px;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-e::before,
.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-w::before {
  background: transparent;
  content: "";
  height: 100%;
  left: 5px;
  position: absolute;
  top: 0;
  width: 2px;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-e:hover::before,
.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-w:hover::before,
.sqlrooms-grid-layout .react-grid-item.resizing > .sqlrooms-grid-resize-handle.react-resizable-handle-e::before,
.sqlrooms-grid-layout .react-grid-item.resizing > .sqlrooms-grid-resize-handle.react-resizable-handle-w::before {
  background: hsl(var(--primary));
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-s {
  bottom: -4px;
  cursor: ns-resize;
  height: 12px;
  left: 0;
  margin-left: 0;
  width: 100%;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-n {
  cursor: ns-resize;
  height: 12px;
  left: 0;
  margin-left: 0;
  top: -4px;
  width: 100%;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-s::before,
.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-n::before {
  align-self: center;
  background: transparent;
  content: "";
  height: 2px;
  left: 0;
  position: absolute;
  top: 5px;
  width: 100%;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-s:hover::before,
.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-n:hover::before,
.sqlrooms-grid-layout .react-grid-item.resizing > .sqlrooms-grid-resize-handle.react-resizable-handle-s::before,
.sqlrooms-grid-layout .react-grid-item.resizing > .sqlrooms-grid-resize-handle.react-resizable-handle-n::before {
  background: hsl(var(--primary));
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-se {
  bottom: -4px;
  cursor: nwse-resize;
  height: 16px;
  margin-left: 0;
  right: -4px;
  width: 16px;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-sw {
  bottom: -4px;
  cursor: nesw-resize;
  height: 16px;
  left: -4px;
  margin-left: 0;
  width: 16px;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-se::before {
  background: transparent;
  border-bottom: 2px solid transparent;
  border-right: 2px solid transparent;
  bottom: 5px;
  content: "";
  height: 8px;
  position: absolute;
  right: 5px;
  width: 8px;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-sw::before {
  background: transparent;
  border-bottom: 2px solid transparent;
  border-left: 2px solid transparent;
  bottom: 5px;
  content: "";
  height: 8px;
  left: 5px;
  position: absolute;
  width: 8px;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-se:hover::before,
.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-sw:hover::before,
.sqlrooms-grid-layout .react-grid-item.resizing > .sqlrooms-grid-resize-handle.react-resizable-handle-se::before,
.sqlrooms-grid-layout .react-grid-item.resizing > .sqlrooms-grid-resize-handle.react-resizable-handle-sw::before {
  border-color: hsl(var(--primary));
}
`;

type GridLayouts = NonNullable<LayoutGridNode['layouts']>;

type RootProps = {
  node: LayoutGridNode;
  path: LayoutPath;
  parentDirection?: ParentDirection;
};

function createDefaultItem(
  node: LayoutNode,
  index: number,
  cols: number,
): LayoutGridItem {
  const id = getGridChildId(node);
  const effectiveCols = Math.max(1, cols);
  const w = Math.min(3, effectiveCols);
  const h = 2;
  return {
    i: id,
    x: (index * w) % effectiveCols,
    y: Math.floor((index * w) / effectiveCols) * h,
    w,
    h,
  };
}

function getGridChildId(node: LayoutNode): string {
  return isLayoutNodeKey(node) ? node : node.id;
}

function getResponsiveCols(
  cols: LayoutGridNode['cols'],
  breakpoints: Record<string, number>,
): Record<string, number> {
  if (typeof cols === 'number') {
    return Object.fromEntries(
      Object.keys(breakpoints).map((breakpoint) => [breakpoint, cols]),
    );
  }

  const fallbackCols = cols?.lg ?? DEFAULT_COLS.lg;

  return Object.fromEntries(
    Object.keys(breakpoints).map((breakpoint) => [
      breakpoint,
      cols?.[breakpoint] ??
        DEFAULT_COLS[breakpoint as keyof typeof DEFAULT_COLS] ??
        fallbackCols,
    ]),
  );
}

function renderResizeHandle(axis: string, ref: Ref<HTMLElement>) {
  return (
    <span
      ref={ref}
      className={`react-resizable-handle react-resizable-handle-${axis} sqlrooms-grid-resize-handle`}
      data-layout-resize-handle={axis}
    />
  );
}

function getResizeHandles(
  resizeHandles: LayoutGridNode['resizeHandles'],
): NonNullable<LayoutGridNode['resizeHandles']> {
  if (!resizeHandles) {
    return DEFAULT_RESIZE_HANDLES;
  }

  const isLegacyDefault =
    (resizeHandles.length === 2 ||
      (resizeHandles.length === 3 && resizeHandles.includes('se'))) &&
    resizeHandles.includes('e') &&
    resizeHandles.includes('s');

  return isLegacyDefault ? DEFAULT_RESIZE_HANDLES : resizeHandles;
}

function areResizeHandlesEqual(
  left: NonNullable<LayoutGridNode['resizeHandles']>,
  right: NonNullable<LayoutGridNode['resizeHandles']>,
): boolean {
  return (
    left.length === right.length &&
    left.every((handle) => right.includes(handle))
  );
}

function normalizeLayoutItem(
  item: LayoutGridItem,
  gridResizeHandles: NonNullable<LayoutGridNode['resizeHandles']>,
): LayoutGridItem {
  const normalized: LayoutGridItem = {
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
  };

  if (item.minW != null) normalized.minW = item.minW;
  if (item.maxW != null) normalized.maxW = item.maxW;
  if (item.minH != null) normalized.minH = item.minH;
  if (item.maxH != null) normalized.maxH = item.maxH;
  if (item.static != null) normalized.static = item.static;
  if (item.isDraggable != null) normalized.isDraggable = item.isDraggable;
  if (item.isResizable != null) normalized.isResizable = item.isResizable;
  if (item.resizeHandles != null) {
    const itemResizeHandles = getResizeHandles(item.resizeHandles);
    if (!areResizeHandlesEqual(itemResizeHandles, gridResizeHandles)) {
      normalized.resizeHandles = itemResizeHandles;
    }
  }

  return normalized;
}

function normalizeLayouts(
  layouts: GridLayouts,
  gridResizeHandles: NonNullable<LayoutGridNode['resizeHandles']>,
): GridLayouts {
  return Object.fromEntries(
    Object.entries(layouts).map(([breakpoint, layout]) => [
      breakpoint,
      layout.map((item) => normalizeLayoutItem(item, gridResizeHandles)),
    ]),
  );
}

const Root: FC<RootProps> = ({node, path, parentDirection}) => {
  const renderNode = useRenderNode();
  const panelInfo = useGetPanel(node);
  const {rootLayout, onLayoutChange} = useLayoutRendererContext();
  const childIds = useMemo(
    () => node.children.map(getGridChildId),
    [node.children],
  );
  const breakpoints = node.breakpoints ?? DEFAULT_BREAKPOINTS;
  const cols = useMemo(
    () => getResponsiveCols(node.cols, breakpoints),
    [breakpoints, node.cols],
  );
  const resizeHandles = useMemo(
    () => getResizeHandles(node.resizeHandles),
    [node.resizeHandles],
  );
  const layouts = useMemo(() => {
    if (node.layouts) return normalizeLayouts(node.layouts, resizeHandles);
    return Object.fromEntries(
      Object.entries(cols).map(([breakpoint, breakpointCols]) => [
        breakpoint,
        node.children.map((child, index) =>
          createDefaultItem(child, index, breakpointCols),
        ),
      ]),
    );
  }, [cols, node.children, node.layouts, resizeHandles]);
  const scrollContainerRef = useScrollNewGridChildIntoView(
    node.id,
    childIds,
    layouts,
  );
  const handleLayoutChange = useCallback(
    (allLayouts: GridLayouts) => {
      if (!onLayoutChange) {
        return;
      }

      const normalizedLayouts = normalizeLayouts(allLayouts, resizeHandles);
      if (
        JSON.stringify(node.layouts ?? {}) === JSON.stringify(normalizedLayouts)
      ) {
        return;
      }

      const nextRootLayout = JSON.parse(
        JSON.stringify(rootLayout),
      ) as LayoutNode;
      const result = findNodeById(nextRootLayout, node.id);
      if (!result || !isLayoutGridNode(result.node)) {
        return;
      }

      result.node.layouts = normalizedLayouts;
      onLayoutChange(nextRootLayout);
    },
    [node.id, node.layouts, onLayoutChange, resizeHandles, rootLayout],
  );

  const defaultComponent = (
    <div className="flex h-full min-h-0 w-full flex-col" data-grid-id={node.id}>
      <style>{GRID_LAYOUT_STYLES}</style>
      {panelInfo?.title && (
        <div className="border-border flex items-center gap-2 border-b px-3 py-2">
          {panelInfo.icon && <panelInfo.icon className="h-4 w-4" />}
          <span className="text-sm font-medium">{panelInfo.title}</span>
        </div>
      )}
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-auto p-2"
      >
        <ResponsiveGridLayout
          className="layout sqlrooms-grid-layout"
          layouts={layouts}
          cols={cols}
          breakpoints={breakpoints}
          rowHeight={node.rowHeight ?? 220}
          margin={node.margin ?? [12, 12]}
          containerPadding={node.containerPadding ?? [0, 0]}
          compactType={node.compactType ?? 'vertical'}
          preventCollision={node.preventCollision}
          isBounded={node.isBounded}
          autoSize={node.autoSize ?? true}
          draggableHandle='[data-layout-drag-handle="true"]'
          draggableCancel={
            'button, input, textarea, select, a, [data-layout-drag-cancel="true"]'
          }
          resizeHandles={resizeHandles}
          resizeHandle={renderResizeHandle}
          onLayoutChange={(_, allLayouts) =>
            handleLayoutChange(allLayouts as GridLayouts)
          }
        >
          {node.children.map((child) => {
            const childId = getGridChildId(child);
            return (
              <div
                key={childId}
                className="h-full"
                data-layout-grid-item-id={childId}
                style={{overflow: 'visible'}}
              >
                <div className="bg-background h-full overflow-hidden rounded border">
                  {renderNode({
                    node: child,
                    path: [...path, node.id, childId],
                    containerType: 'grid',
                    containerId: node.id,
                  })}
                </div>
              </div>
            );
          })}
        </ResponsiveGridLayout>
      </div>
    </div>
  );

  return (
    <LayoutNodeProvider
      containerType="grid"
      node={node}
      path={path}
      parentDirection={parentDirection}
    >
      <RendererSwitcher defaultComponent={defaultComponent} />
    </LayoutNodeProvider>
  );
};

export const GridLayout = {Root};
