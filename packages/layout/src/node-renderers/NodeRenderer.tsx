import {
  isLayoutMosaicNode,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutSplitNode,
  LayoutTabsNode as LayoutTabsNodeType,
} from '@sqlrooms/layout-config';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@sqlrooms/ui';
import React, {FC} from 'react';
import {CollapsiblePanelWrapper} from './CollapsiblePanelWrapper';
import {LeafRenderer} from './LeafRenderer';
import {MosaicRenderer} from './MosaicRenderer';
import {
  getChildAreaId,
  getPanelId,
  getSizeProps,
  isCollapsed,
  type NodeRenderProps,
} from './types';
import {convertSizePropsToStyle} from './utils';
import {useLayoutRendererContext} from '../LayoutRendererContext';
import {TabsLayoutRenderer} from './tabs-node-renderer/TabsLayoutRenderer';

// ---------------------------------------------------------------------------
// NodeRenderer – recursive dispatcher
// ---------------------------------------------------------------------------

export const NodeRenderer: FC<NodeRenderProps> = ({node, ...rest}) => {
  if (isLayoutNodeKey(node)) {
    return <LeafRenderer node={node} {...rest} />;
  }

  if (isLayoutPanelNode(node)) {
    return <LeafRenderer node={node.id} {...rest} />;
  }

  if (isLayoutSplitNode(node)) {
    return <SplitRenderer node={node} {...rest} />;
  }

  if (isLayoutTabsNode(node)) {
    return <TabsRenderer node={node} {...rest} />;
  }

  if (isLayoutMosaicNode(node)) {
    return <MosaicRenderer node={node} {...rest} />;
  }

  return null;
};

// ---------------------------------------------------------------------------
// SplitRenderer
// ---------------------------------------------------------------------------

const SplitRenderer: FC<NodeRenderProps<LayoutSplitNode>> = ({node, path}) => {
  const orientation = node.direction === 'column' ? 'vertical' : 'horizontal';
  const isResizable = node.resizable !== false;

  const {onCollapse, onExpand} = useLayoutRendererContext();

  return (
    <ResizablePanelGroup orientation={orientation}>
      {node.children.map((child, i) => {
        const key = getPanelId(child);
        const sizeProps = getSizeProps(child);
        const isLast = i === node.children.length - 1;
        const collapsed = isCollapsed(child);
        const areaId = getChildAreaId(child);
        const childPathSegment = areaId ?? key ?? i;

        const childContent = (
          <NodeRenderer
            node={child}
            path={[...path, childPathSegment]}
            containerType="split"
            containerId={node.id}
            parentDirection={node.direction}
          />
        );

        const panelElement = !isResizable ? (
          <div
            className="flex-1"
            style={convertSizePropsToStyle(sizeProps, orientation)}
          >
            {childContent}
          </div>
        ) : sizeProps.collapsible ? (
          <CollapsiblePanelWrapper
            id={key}
            collapsed={collapsed}
            areaId={areaId}
            onExpand={onExpand}
            onCollapse={onCollapse}
            {...sizeProps}
          >
            {childContent}
          </CollapsiblePanelWrapper>
        ) : (
          <ResizablePanel id={key} {...sizeProps}>
            {childContent}
          </ResizablePanel>
        );

        return (
          <React.Fragment key={key}>
            {panelElement}
            {!isLast && isResizable && (
              <ResizableHandle className="bg-border hover:bg-primary/60 transition-colors" />
            )}
          </React.Fragment>
        );
      })}
    </ResizablePanelGroup>
  );
};

// ---------------------------------------------------------------------------
// TabsRenderer
// ---------------------------------------------------------------------------

const TabsRenderer: FC<NodeRenderProps<LayoutTabsNodeType>> = ({
  node,
  path,
  parentDirection,
}) => {
  return (
    <TabsLayoutRenderer.Root
      node={node}
      path={path}
      parentDirection={parentDirection}
    />
  );
};
