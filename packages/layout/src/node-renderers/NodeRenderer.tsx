import {
  isLayoutMosaicNode,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
} from '@sqlrooms/layout-config';
import {FC} from 'react';
import {LeafLayout} from './leaf-node-renderer/LeafLayout';
import {type NodeRenderProps} from './types';
import {TabsLayout} from './tabs-node-renderer/TabsLayout';
import {SplitLayout} from './split-node-renderer/SplitLayout';
import {MosaicLayout} from './mosaic-node-renderer/MosaicLayout';

export const NodeRenderer: FC<NodeRenderProps> = ({
  node,
  path,
  parentDirection,
}) => {
  if (isLayoutNodeKey(node) || isLayoutPanelNode(node)) {
    return <LeafLayout.Root node={node} path={path} />;
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
    return <MosaicLayout.Root node={node} path={path} />;
  }

  return null;
};
