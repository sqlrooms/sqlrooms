import {FC} from 'react';
import {LayoutNodeRenderer} from '../LayoutNodeRenderer';
import {useActiveTab} from './useActiveTab';

export const TabsLayoutTabContent: FC = () => {
  const {container, node, path} = useActiveTab();

  if (!node || !path) {
    return null;
  }

  return (
    <LayoutNodeRenderer
      node={node}
      path={path}
      containerType="tabs"
      containerId={container.id}
    />
  );
};
