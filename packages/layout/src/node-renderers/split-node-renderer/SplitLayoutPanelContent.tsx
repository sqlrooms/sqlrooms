import {FC} from 'react';
import {useSplitNodeContext} from '../../LayoutNodeContext';
import {getLayoutNodeId, LayoutNode} from '@sqlrooms/layout-config';
import {LayoutNodeRenderer} from '../LayoutNodeRenderer';

type SplitLayoutPanelContentProps = {
  node: LayoutNode;
};

export const SplitLayoutPanelContent: FC<SplitLayoutPanelContentProps> = ({
  node,
}) => {
  const {node: parentNode, path} = useSplitNodeContext();

  const panelId = getLayoutNodeId(node);

  return (
    <LayoutNodeRenderer
      node={node}
      path={[...path, panelId]}
      containerType="split"
      containerId={parentNode.id}
      parentDirection={parentNode.direction}
    />
  );
};
