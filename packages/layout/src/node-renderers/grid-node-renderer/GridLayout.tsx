import {
  LayoutGridItem,
  LayoutGridNode,
  LayoutNode,
  isLayoutNodeKey,
} from '@sqlrooms/layout-config';
import {FC, Ref, useMemo} from 'react';
import {Responsive, WidthProvider} from 'react-grid-layout';
import {LayoutNodeProvider} from '../../LayoutNodeContext';
import {ParentDirection} from '../../layout-base-types';
import {LayoutPath} from '../../types';
import {useRenderNode} from '../RenderNodeContext';
import {RendererSwitcher} from '../RendererSwitcher';
import {useGetPanel} from '../../useGetPanel';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const DEFAULT_BREAKPOINTS = {lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0};
const DEFAULT_COLS = {lg: 12, md: 10, sm: 6, xs: 4, xxs: 2};
const GRID_LAYOUT_STYLES = `
.sqlrooms-grid-layout .react-grid-item {
  overflow: visible;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle {
  background-image: none;
  box-sizing: border-box;
  opacity: 0.75;
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

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-e::before {
  background: hsl(var(--border));
  content: "";
  height: 100%;
  left: 5px;
  position: absolute;
  top: 0;
  width: 2px;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-e:hover::before,
.sqlrooms-grid-layout .react-grid-item.resizing > .sqlrooms-grid-resize-handle.react-resizable-handle-e::before {
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

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-s::before {
  align-self: center;
  background: hsl(var(--border));
  content: "";
  height: 2px;
  left: 0;
  position: absolute;
  top: 5px;
  width: 100%;
}

.sqlrooms-grid-layout .react-grid-item > .sqlrooms-grid-resize-handle.react-resizable-handle-s:hover::before,
.sqlrooms-grid-layout .react-grid-item.resizing > .sqlrooms-grid-resize-handle.react-resizable-handle-s::before {
  background: hsl(var(--primary));
}
`;

type RootProps = {
  node: LayoutGridNode;
  path: LayoutPath;
  parentDirection?: ParentDirection;
};

function createDefaultItem(node: LayoutNode, index: number): LayoutGridItem {
  const id = isLayoutNodeKey(node) ? node : node.id;
  return {i: id, x: (index * 3) % 12, y: Math.floor(index / 4), w: 3, h: 2};
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

const Root: FC<RootProps> = ({node, path, parentDirection}) => {
  const renderNode = useRenderNode();
  const panelInfo = useGetPanel(node);

  const layouts = useMemo(() => {
    if (node.layouts) return node.layouts;
    return {
      lg: node.children.map((child, index) => createDefaultItem(child, index)),
    };
  }, [node.children, node.layouts]);
  const breakpoints = node.breakpoints ?? DEFAULT_BREAKPOINTS;
  const cols = useMemo(
    () => getResponsiveCols(node.cols, breakpoints),
    [breakpoints, node.cols],
  );

  const defaultComponent = (
    <div className="flex h-full w-full flex-col" data-grid-id={node.id}>
      <style>{GRID_LAYOUT_STYLES}</style>
      {panelInfo?.title && (
        <div className="border-border flex items-center gap-2 border-b px-3 py-2">
          {panelInfo.icon && <panelInfo.icon className="h-4 w-4" />}
          <span className="text-sm font-medium">{panelInfo.title}</span>
        </div>
      )}
      <div className="flex-1 overflow-auto p-2">
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
          resizeHandles={node.resizeHandles ?? ['e', 's']}
          resizeHandle={renderResizeHandle}
        >
          {node.children.map((child) => {
            const childId = isLayoutNodeKey(child) ? child : child.id;
            return (
              <div
                key={childId}
                className="h-full"
                style={{overflow: 'visible'}}
              >
                <div className="h-full overflow-hidden rounded border">
                  {renderNode({
                    node: child,
                    path: [...path, node.id, childId],
                    containerType: 'root',
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
