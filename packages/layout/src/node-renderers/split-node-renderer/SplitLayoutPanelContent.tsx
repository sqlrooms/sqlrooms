import {FC} from 'react';
import {useSplitNodeContext} from '../../LayoutNodeContext';
import {LayoutNode} from '@sqlrooms/layout-config';
import {useRenderNode} from '../RenderNodeContext';

type SplitLayoutPanelContentProps = {
  node: LayoutNode;
};

export const SplitLayoutPanelContent: FC<SplitLayoutPanelContentProps> = ({
  node,
}) => {
  const {node: parentNode, path} = useSplitNodeContext();
  const renderNode = useRenderNode();

  return renderNode({
    node,
    path,
    containerType: 'split',
    containerId: parentNode.id,
    parentDirection: parentNode.direction,
  });
};
