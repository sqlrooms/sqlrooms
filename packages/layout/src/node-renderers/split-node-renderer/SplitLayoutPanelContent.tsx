import {FC} from 'react';
import {useSplitNodeContext} from '../../LayoutNodeContext';
import {
  getLayoutNodeId,
  isLayoutSplitNode,
  LayoutNode,
} from '@sqlrooms/layout-config';
import {LayoutNodeRenderer} from '../LayoutNodeRenderer';

type SplitLayoutPanelContentProps = {
  node: LayoutNode;
};

export const SplitLayoutPanelContent: FC<SplitLayoutPanelContentProps> = ({
  node,
}) => {
  const {node: parentNode, path} = useSplitNodeContext();

  const panelId = getLayoutNodeId(node);
  const nextPath =
    parentNode.draggable === true && isLayoutSplitNode(node)
      ? path
      : [...path, panelId];

  return (
    <LayoutNodeRenderer
      node={node}
      path={nextPath}
      containerType="split"
      containerId={parentNode.id}
      parentDirection={parentNode.direction}
    />
  );
};
