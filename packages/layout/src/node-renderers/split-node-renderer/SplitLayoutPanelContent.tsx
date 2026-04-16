import {FC} from 'react';
import {useSplitNodeContext} from '../../LayoutNodeContext';
import {LayoutNode} from '@sqlrooms/layout-config';
import {LayoutNodeRenderer} from '../LayoutNodeRenderer';
import {appendSemanticLayoutPath} from '../utils';

type SplitLayoutPanelContentProps = {
  node: LayoutNode;
};

export const SplitLayoutPanelContent: FC<SplitLayoutPanelContentProps> = ({
  node,
}) => {
  const {node: parentNode, path} = useSplitNodeContext();

  const nextPath = appendSemanticLayoutPath(path, node);

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
