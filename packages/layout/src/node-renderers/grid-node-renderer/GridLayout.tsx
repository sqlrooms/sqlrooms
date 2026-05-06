import {
  LayoutGridItem,
  LayoutGridNode,
  LayoutNode,
  isLayoutGridNode,
} from '@sqlrooms/layout-config';
import {CSSProperties, FC, Ref, useCallback, useMemo, useState} from 'react';
import {Responsive, WidthProvider} from 'react-grid-layout';
import {
  createDefaultGridLayouts,
  DEFAULT_GRID_BREAKPOINTS,
  getGridChildId,
  getResponsiveGridCols,
  type GridLayouts,
} from '../../grid-layout-utils';
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

const DEFAULT_RESIZE_HANDLES: NonNullable<LayoutGridNode['resizeHandles']> = [
  'n',
  'e',
  's',
  'w',
  'se',
  'sw',
  'nw',
  'ne',
];
const GRID_RESIZE_HANDLE_AXES = DEFAULT_RESIZE_HANDLES;
const DEFAULT_MARGIN: NonNullable<LayoutGridNode['margin']> = [12, 12];
const DEFAULT_CONTAINER_PADDING: NonNullable<
  LayoutGridNode['containerPadding']
> = [0, 0];
const GRID_LAYOUT_STYLES = `
.sqlrooms-grid-layout .react-grid-item {
  overflow: visible;
  transition: none;
}

.sqlrooms-grid-layout .react-grid-item.react-draggable-dragging {
  opacity: 1;
}

.sqlrooms-grid-layout.sqlrooms-grid-layout-interacting,
.sqlrooms-grid-layout.sqlrooms-grid-layout-interacting * {
  -webkit-user-select: none !important;
  user-select: none !important;
}

.sqlrooms-grid-layout .react-grid-item.react-grid-placeholder {
  background: hsl(var(--primary) / 0.18);
  border: 1px solid hsl(var(--primary) / 0.35);
  opacity: 1;
  transition: none;
}

.sqlrooms-grid-layout .react-grid-item.react-grid-placeholder.placeholder-resizing {
  transition: none;
}

.sqlrooms-grid-layout .react-grid-item.sqlrooms-grid-resize-follow-preview {
  height: var(--sqlrooms-grid-preview-height) !important;
  transform: translate(
    var(--sqlrooms-grid-preview-left),
    var(--sqlrooms-grid-preview-top)
  ) !important;
  transition: none;
  width: var(--sqlrooms-grid-preview-width) !important;
}

.sqlrooms-grid-resize-size {
  background: hsl(var(--background) / 0.92);
  border: 1px solid hsl(var(--primary) / 0.28);
  border-radius: 9999px;
  color: hsl(var(--foreground));
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  padding: 4px 7px;
  pointer-events: none;
  position: absolute;
  right: 8px;
  top: 8px;
  z-index: 30;
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
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-e .react-grid-item.resizing > .react-resizable-handle-e,
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-s .react-grid-item.resizing > .react-resizable-handle-s,
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-w .react-grid-item.resizing > .react-resizable-handle-w,
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-n .react-grid-item.resizing > .react-resizable-handle-n,
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-se .react-grid-item.resizing > .react-resizable-handle-se,
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-sw .react-grid-item.resizing > .react-resizable-handle-sw,
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-nw .react-grid-item.resizing > .react-resizable-handle-nw,
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-ne .react-grid-item.resizing > .react-resizable-handle-ne {
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
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-e .react-grid-item.resizing > .react-resizable-handle-e::before,
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-w .react-grid-item.resizing > .react-resizable-handle-w::before {
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
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-s .react-grid-item.resizing > .react-resizable-handle-s::before,
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-n .react-grid-item.resizing > .react-resizable-handle-n::before {
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

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-nw {
  cursor: nwse-resize;
  height: 16px;
  left: -4px;
  margin-left: 0;
  top: -4px;
  width: 16px;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-ne {
  cursor: nesw-resize;
  height: 16px;
  margin-left: 0;
  right: -4px;
  top: -4px;
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

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-nw::before {
  background: transparent;
  border-left: 2px solid transparent;
  border-top: 2px solid transparent;
  content: "";
  height: 8px;
  left: 5px;
  position: absolute;
  top: 5px;
  width: 8px;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-ne::before {
  background: transparent;
  border-right: 2px solid transparent;
  border-top: 2px solid transparent;
  content: "";
  height: 8px;
  position: absolute;
  right: 5px;
  top: 5px;
  width: 8px;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-se:hover::before,
.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-sw:hover::before,
.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-nw:hover::before,
.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-ne:hover::before,
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-se .react-grid-item.resizing > .react-resizable-handle-se::before,
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-sw .react-grid-item.resizing > .react-resizable-handle-sw::before,
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-nw .react-grid-item.resizing > .react-resizable-handle-nw::before,
.sqlrooms-grid-layout.sqlrooms-grid-layout-resizing-ne .react-grid-item.resizing > .react-resizable-handle-ne::before {
  border-color: hsl(var(--primary));
}
`;

type RootProps = {
  node: LayoutGridNode;
  path: LayoutPath;
  parentDirection?: ParentDirection;
};

type GridMetrics = {
  width: number;
  margin: [number, number];
  cols: number;
  containerPadding: [number, number];
};
type GridCallbackItem = Pick<LayoutGridItem, 'i' | 'x' | 'y' | 'w' | 'h'>;
type GridResizeHandleAxis = NonNullable<
  LayoutGridNode['resizeHandles']
>[number];

function getGridItemPreviewStyle(
  item: LayoutGridItem,
  rowHeight: number,
  metrics: GridMetrics,
): CSSProperties | undefined {
  if (metrics.width <= 0 || metrics.cols <= 0) {
    return undefined;
  }

  const [marginX, marginY] = metrics.margin;
  const [paddingX, paddingY] = metrics.containerPadding;
  const colWidth =
    (metrics.width - paddingX * 2 - marginX * (metrics.cols - 1)) /
    metrics.cols;

  return {
    left: paddingX + item.x * (colWidth + marginX),
    top: paddingY + item.y * (rowHeight + marginY),
    width: item.w * colWidth + Math.max(0, item.w - 1) * marginX,
    height: item.h * rowHeight + Math.max(0, item.h - 1) * marginY,
  };
}

function toPreviewGridItem(item: GridCallbackItem): LayoutGridItem {
  return {
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
  };
}

function getResizeFollowStyle(
  previewStyle: CSSProperties | undefined,
): CSSProperties {
  if (!previewStyle) {
    return {overflow: 'visible'};
  }

  return {
    overflow: 'visible',
    '--sqlrooms-grid-preview-left': `${previewStyle.left}px`,
    '--sqlrooms-grid-preview-top': `${previewStyle.top}px`,
    '--sqlrooms-grid-preview-width': `${previewStyle.width}px`,
    '--sqlrooms-grid-preview-height': `${previewStyle.height}px`,
  } as CSSProperties;
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

function isGridResizeHandleAxis(
  axis: string | undefined,
): axis is GridResizeHandleAxis {
  return (
    axis != null &&
    (GRID_RESIZE_HANDLE_AXES as readonly string[]).includes(axis)
  );
}

function getResizeHandleAxis(event: MouseEvent): GridResizeHandleAxis | null {
  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }

  const handle = target.closest<HTMLElement>('[data-layout-resize-handle]');
  const axis = handle?.dataset.layoutResizeHandle;
  return isGridResizeHandleAxis(axis) ? axis : null;
}

function getResizeHandles(
  resizeHandles: LayoutGridNode['resizeHandles'],
): NonNullable<LayoutGridNode['resizeHandles']> {
  if (!resizeHandles) {
    return DEFAULT_RESIZE_HANDLES;
  }

  return resizeHandles;
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
  const rowHeight = node.rowHeight ?? 220;
  const margin = node.margin ?? DEFAULT_MARGIN;
  const containerPadding = node.containerPadding ?? DEFAULT_CONTAINER_PADDING;
  const [gridMetrics, setGridMetrics] = useState<GridMetrics>(() => ({
    width: 0,
    margin,
    cols: 12,
    containerPadding,
  }));
  const [isInteracting, setIsInteracting] = useState(false);
  const [activeResizeHandle, setActiveResizeHandle] =
    useState<GridResizeHandleAxis | null>(null);
  const [resizePreviewItem, setResizePreviewItem] =
    useState<LayoutGridItem | null>(null);
  const childIds = useMemo(
    () => node.children.map(getGridChildId),
    [node.children],
  );
  const breakpoints = node.breakpoints ?? DEFAULT_GRID_BREAKPOINTS;
  const cols = useMemo(
    () => getResponsiveGridCols(node.cols, breakpoints),
    [breakpoints, node.cols],
  );
  const resizeHandles = useMemo(
    () => getResizeHandles(node.resizeHandles),
    [node.resizeHandles],
  );
  const layouts = useMemo(() => {
    if (node.layouts) return normalizeLayouts(node.layouts, resizeHandles);
    return createDefaultGridLayouts(node.children, cols);
  }, [cols, node.children, node.layouts, resizeHandles]);
  const scrollContainerRef = useScrollNewGridChildIntoView(
    node.id,
    childIds,
    layouts,
  );
  const resizePreviewStyle = resizePreviewItem
    ? getGridItemPreviewStyle(resizePreviewItem, rowHeight, gridMetrics)
    : undefined;
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
  const handleDragStart = useCallback(() => {
    setIsInteracting(true);
  }, []);
  const handleDragStop = useCallback(() => {
    setIsInteracting(false);
  }, []);
  const handleWidthChange = useCallback(
    (
      width: number,
      widthChangeMargin: [number, number],
      breakpointCols: number,
      widthChangeContainerPadding: [number, number],
    ) => {
      setGridMetrics({
        width,
        margin: widthChangeMargin,
        cols: breakpointCols,
        containerPadding: widthChangeContainerPadding,
      });
    },
    [],
  );
  const handleResizeStart = useCallback(
    (
      _layout: GridCallbackItem[],
      _oldItem: GridCallbackItem,
      newItem: GridCallbackItem,
      _placeholder: GridCallbackItem,
      event: MouseEvent,
    ) => {
      setIsInteracting(true);
      setActiveResizeHandle(getResizeHandleAxis(event));
      setResizePreviewItem(toPreviewGridItem(newItem));
    },
    [],
  );
  const handleResize = useCallback(
    (
      _: GridCallbackItem[],
      __: GridCallbackItem,
      newItem: GridCallbackItem,
      placeholder: GridCallbackItem | null | undefined,
    ) => {
      setResizePreviewItem(toPreviewGridItem(placeholder ?? newItem));
    },
    [],
  );
  const handleResizeStop = useCallback(() => {
    setIsInteracting(false);
    setActiveResizeHandle(null);
    setResizePreviewItem(null);
  }, []);

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
        className="min-h-0 flex-1 overflow-auto px-5 py-2"
      >
        <ResponsiveGridLayout
          className={[
            'layout sqlrooms-grid-layout',
            isInteracting ? 'sqlrooms-grid-layout-interacting' : '',
            activeResizeHandle
              ? `sqlrooms-grid-layout-resizing-${activeResizeHandle}`
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          layouts={layouts}
          cols={cols}
          breakpoints={breakpoints}
          rowHeight={rowHeight}
          margin={margin}
          containerPadding={containerPadding}
          compactType={node.compactType === undefined ? null : node.compactType}
          preventCollision={node.preventCollision}
          isBounded={node.isBounded}
          autoSize={node.autoSize ?? true}
          draggableHandle='[data-layout-drag-handle="true"]'
          draggableCancel={
            'button, input, textarea, select, a, [data-layout-drag-cancel="true"]'
          }
          resizeHandles={resizeHandles}
          resizeHandle={renderResizeHandle}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          onWidthChange={handleWidthChange}
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeStop={handleResizeStop}
          onLayoutChange={(_, allLayouts) =>
            handleLayoutChange(allLayouts as GridLayouts)
          }
        >
          {node.children.map((child) => {
            const childId = getGridChildId(child);
            const isResizePreviewChild =
              resizePreviewItem?.i === childId && resizePreviewStyle != null;
            return (
              <div
                key={childId}
                className={
                  isResizePreviewChild
                    ? 'sqlrooms-grid-resize-follow-preview h-full'
                    : 'h-full'
                }
                data-layout-grid-item-id={childId}
                style={getResizeFollowStyle(
                  isResizePreviewChild ? resizePreviewStyle : undefined,
                )}
              >
                <div className="bg-background h-full overflow-hidden rounded border">
                  {renderNode({
                    node: child,
                    path: [...path, node.id, childId],
                    containerType: 'grid',
                    containerId: node.id,
                  })}
                </div>
                {isResizePreviewChild ? (
                  <div className="sqlrooms-grid-resize-size">
                    {resizePreviewItem.w} cols x {resizePreviewItem.h} rows
                  </div>
                ) : null}
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
