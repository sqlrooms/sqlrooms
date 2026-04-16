import {FC} from 'react';
import {useSplitNodeContext} from '../../LayoutNodeContext';
import {LayoutNode} from '@sqlrooms/layout-config';
import {getPanelId} from '../types';
import {NodeRenderer} from '../NodeRenderer';

type SplitLayoutPanelContentProps = {
  node: LayoutNode;
};

export const SplitLayoutPanelContent: FC<SplitLayoutPanelContentProps> = ({
  node,
}) => {
  const {node: parentNode, path} = useSplitNodeContext();

  const panelId = getPanelId(node);

  return (
    <NodeRenderer
      node={node}
      path={[...path, panelId]}
      containerType="split"
      containerId={parentNode.id}
      parentDirection={parentNode.direction}
    />
  );
};
