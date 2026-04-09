import {FC} from 'react';
import {NodeRenderer} from '../NodeRenderer';
import {useTabsLayoutContext} from './TabsLayoutProvider';

export const TabsLayoutTabContent: FC = () => {
  const {activeChild, activeChildPath, node} = useTabsLayoutContext();

  if (!activeChild || !activeChildPath) {
    return null;
  }

  return (
    <NodeRenderer
      node={activeChild}
      path={activeChildPath}
      containerType="tabs"
      containerId={node.id}
    />
  );
};
