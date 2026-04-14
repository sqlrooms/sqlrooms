import {FC} from 'react';
import {NodeRenderer} from '../NodeRenderer';
import {useActiveTab} from './useActiveTab';

export const TabsLayoutTabContent: FC = () => {
  const {container, node, path} = useActiveTab();

  if (!node || !path) {
    return null;
  }

  return (
    <NodeRenderer
      node={node}
      path={path}
      containerType="tabs"
      containerId={container.id}
    />
  );
};
