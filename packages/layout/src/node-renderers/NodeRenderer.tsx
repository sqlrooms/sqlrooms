import {
  isLayoutMosaicNode,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
} from '@sqlrooms/layout-config';
import {FC} from 'react';
import {LeafRenderer} from './LeafRenderer';
import {MosaicRenderer} from './MosaicRenderer';
import {SplitRenderer} from './SplitRenderer';
import {TabsRenderer} from './TabsRenderer';
import type {NodeRenderProps} from './types';

export const NodeRenderer: FC<NodeRenderProps> = ({node, ...rest}) => {
  if (typeof node === 'string') {
    return <LeafRenderer panelId={node} {...rest} />;
  }
  if (isLayoutPanelNode(node)) {
    return <LeafRenderer panelId={node.id} {...rest} />;
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
