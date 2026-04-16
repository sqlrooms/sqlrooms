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
  getPanelId,
  getLayoutNodeSize,
  isCollapsed,
  type NodeRenderProps,
} from './types';
import {convertLayoutNodeSizeToStyle} from './utils';
import {TabsLayout} from './tabs-node-renderer/TabsLayout';
import {LayoutNodeProvider} from '../LayoutNodeContext';

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

  return (
    <LayoutNodeProvider containerType="split" node={node} path={path}>
      <ResizablePanelGroup orientation={orientation}>
        {node.children.map((child, i) => {
          const panelId = getPanelId(child);
          const sizeProps = getLayoutNodeSize(child);
          const isLast = i === node.children.length - 1;
          const collapsed = isCollapsed(child);
          const childPathSegment = panelId ?? i;

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
              style={convertLayoutNodeSizeToStyle(sizeProps, orientation)}
            >
              {childContent}
            </div>
          ) : sizeProps.collapsible ? (
            <CollapsiblePanelWrapper
              panelId={panelId}
              collapsed={collapsed}
              {...sizeProps}
            >
              {childContent}
            </CollapsiblePanelWrapper>
          ) : (
            <ResizablePanel id={panelId} {...sizeProps}>
              {childContent}
            </ResizablePanel>
          );

          return (
            <React.Fragment key={panelId}>
              {panelElement}
              {!isLast && isResizable && (
                <ResizableHandle className="bg-border hover:bg-primary/60 transition-colors" />
              )}
            </React.Fragment>
          );
        })}
      </ResizablePanelGroup>
    </LayoutNodeProvider>
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
    <TabsLayout.Root
      node={node}
      path={path}
      parentDirection={parentDirection}
    />
  );
};
