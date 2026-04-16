import {
  isLayoutMosaicNode,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
} from '@sqlrooms/layout-config';
import {FC} from 'react';
import {LeafRenderer} from './LeafRenderer';
import {MosaicRenderer} from './MosaicRenderer';
import {type NodeRenderProps} from './types';
import {TabsLayout} from './tabs-node-renderer/TabsLayout';
import {SplitLayout} from './split-node-renderer/SplitLayout';

// ---------------------------------------------------------------------------
// NodeRenderer – recursive dispatcher
// ---------------------------------------------------------------------------

export const NodeRenderer: FC<NodeRenderProps> = ({node, ...rest}) => {
  const {path, parentDirection} = rest;

  if (isLayoutNodeKey(node)) {
    return <LeafRenderer node={node} {...rest} />;
  }

  if (isLayoutPanelNode(node)) {
    return <LeafRenderer node={node.id} {...rest} />;
  }

  if (isLayoutSplitNode(node)) {
    return <SplitLayout.Root node={node} path={path} />;
  }

  if (isLayoutTabsNode(node)) {
    return (
      <TabsLayout.Root
        node={node}
        path={path}
        parentDirection={parentDirection}
      />
    );
  }

  if (isLayoutMosaicNode(node)) {
    return <MosaicRenderer node={node} {...rest} />;
  }

  return null;
};
