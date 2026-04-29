import {
  LayoutGridItem,
  LayoutGridNode,
  LayoutNode,
  isLayoutNodeKey,
} from '@sqlrooms/layout-config';
import {FC, useMemo} from 'react';
import GridLayoutPrimitive, {
  Responsive,
  WidthProvider,
} from 'react-grid-layout';
import {LayoutNodeProvider} from '../../LayoutNodeContext';
import {ParentDirection} from '../../layout-base-types';
import {LayoutPath} from '../../types';
import {useRenderNode} from '../RenderNodeContext';
import {RendererSwitcher} from '../RendererSwitcher';
import {useGetPanel} from '../../useGetPanel';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

type RootProps = {
  node: LayoutGridNode;
  path: LayoutPath;
  parentDirection?: ParentDirection;
};

function createDefaultItem(node: LayoutNode, index: number): LayoutGridItem {
  const id = isLayoutNodeKey(node) ? node : node.id;
  return {i: id, x: (index * 3) % 12, y: Math.floor(index / 4), w: 3, h: 2};
}

const Root: FC<RootProps> = ({node, path, parentDirection}) => {
  const renderNode = useRenderNode();
  const panelInfo = useGetPanel(node);

  const defaultCols = typeof node.cols === 'number' ? node.cols : 12;
  const layouts = useMemo(() => {
    if (node.layouts) return node.layouts;
    return {
      lg: node.children.map((child, index) => createDefaultItem(child, index)),
    };
  }, [node.children, node.layouts]);

  const defaultComponent = (
    <div className="flex h-full w-full flex-col" data-grid-id={node.id}>
      {panelInfo?.title && (
        <div className="border-border flex items-center gap-2 border-b px-3 py-2">
          {panelInfo.icon && <panelInfo.icon className="h-4 w-4" />}
          <span className="text-sm font-medium">{panelInfo.title}</span>
        </div>
      )}
      <div className="flex-1 overflow-auto p-2">
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          cols={typeof node.cols === 'number' ? {lg: node.cols} : node.cols}
          breakpoints={node.breakpoints}
          rowHeight={node.rowHeight ?? 220}
          margin={node.margin ?? [12, 12]}
          containerPadding={node.containerPadding ?? [0, 0]}
          compactType={node.compactType ?? 'vertical'}
          preventCollision={node.preventCollision}
          isBounded={node.isBounded}
          autoSize={node.autoSize ?? true}
          draggableHandle='[data-layout-drag-handle="true"]'
          resizeHandles={node.resizeHandles ?? ['e', 's']}
        >
          {node.children.map((child) => {
            const childId = isLayoutNodeKey(child) ? child : child.id;
            return (
              <div
                key={childId}
                className="h-full overflow-hidden rounded border"
              >
                {renderNode({
                  node: child,
                  path: [...path, node.id, childId],
                  containerType: 'root',
                  containerId: node.id,
                })}
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
