import {FC, PropsWithChildren, ReactElement, useCallback} from 'react';
import {useSplitNodeContext} from '../../LayoutNodeContext';
import {
  getLayoutNodeId,
  isLayoutNodeKey,
  LayoutNode,
} from '@sqlrooms/layout-config';
import {ResizablePanel} from '@sqlrooms/ui';
import type {PanelSize} from 'react-resizable-panels';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {updateLayoutNodeById} from '../../layout-tree';
import {CollapsiblePanelWrapper} from './CollapsiblePanelWrapper';
import {
  convertLayoutNodeSizeToStyle,
  getLayoutNodeSize,
  isCollapsed,
} from '../utils';
import {SplitLayoutPanelResizableHandle} from './SplitLayoutPanelResizableHandle';

export type SplitLayoutPanelProps = PropsWithChildren<{
  node: LayoutNode;
  nodeIndex: number;
  handleComponent?: ReactElement;
}>;

function formatResizedDefaultSize(
  panelSize: PanelSize,
  previousDefaultSize: string | number | undefined,
) {
  const inPixels = Math.round(panelSize.inPixels);
  const asPercentage = Number(panelSize.asPercentage.toFixed(4));

  if (typeof previousDefaultSize === 'number') {
    return inPixels;
  }

  if (typeof previousDefaultSize === 'string') {
    const trimmedSize = previousDefaultSize.trim();
    if (trimmedSize.endsWith('%')) {
      return `${asPercentage}%`;
    }
    if (trimmedSize.endsWith('px')) {
      return `${inPixels}px`;
    }
  }

  return `${asPercentage}%`;
}

function updateNodeDefaultSize(
  node: LayoutNode,
  defaultSize: string | number,
): LayoutNode {
  if (isLayoutNodeKey(node)) {
    return {
      type: 'panel',
      id: node,
      panel: node,
      defaultSize,
    };
  }

  if (node.defaultSize === defaultSize) {
    return node;
  }

  return {...node, defaultSize};
}

export const SplitLayoutPanel: FC<SplitLayoutPanelProps> = ({
  node,
  nodeIndex,
  handleComponent,
  children,
}) => {
  const {node: parentNode} = useSplitNodeContext();
  const {rootLayout, onLayoutChange} = useLayoutRendererContext();

  const panelId = getLayoutNodeId(node);
  const sizeProps = getLayoutNodeSize(node);
  const collapsed = isCollapsed(node);
  const isLast = nodeIndex === parentNode.children.length - 1;
  const isResizable = parentNode.resizable !== false;

  const handleElement = handleComponent || <SplitLayoutPanelResizableHandle />;
  const handleResize = useCallback(
    (
      panelSize: PanelSize,
      _id: string | number | undefined,
      prevPanelSize: PanelSize | undefined,
    ) => {
      if (!onLayoutChange || !prevPanelSize || panelSize.inPixels <= 0) {
        return;
      }

      const previousDefaultSize = isLayoutNodeKey(node)
        ? undefined
        : node.defaultSize;
      const defaultSize = formatResizedDefaultSize(
        panelSize,
        previousDefaultSize,
      );
      const nextRootLayout = updateLayoutNodeById(
        rootLayout,
        panelId,
        (currentNode) => updateNodeDefaultSize(currentNode, defaultSize),
      );

      if (nextRootLayout !== rootLayout) {
        onLayoutChange(nextRootLayout);
      }
    },
    [node, onLayoutChange, panelId, rootLayout],
  );

  if (!isResizable) {
    return (
      <div
        className="flex-1"
        style={convertLayoutNodeSizeToStyle(sizeProps, parentNode.direction)}
      >
        {children}
      </div>
    );
  }

  if (sizeProps.collapsible) {
    return (
      <>
        <CollapsiblePanelWrapper
          panelId={panelId}
          collapsed={collapsed}
          onResize={handleResize}
          {...sizeProps}
        >
          {children}
        </CollapsiblePanelWrapper>
        {!isLast && handleElement}
      </>
    );
  }

  return (
    <>
      <ResizablePanel id={panelId} onResize={handleResize} {...sizeProps}>
        {children}
      </ResizablePanel>
      {!isLast && handleElement}
    </>
  );
};
