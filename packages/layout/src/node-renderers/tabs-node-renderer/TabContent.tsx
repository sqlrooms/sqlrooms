import {FC} from 'react';
import {getPanelId} from '../types';
import {NodeRenderer} from '../NodeRenderer';
import {useTabsLayoutRendererContext} from './TabsLayoutRendererContext';

export const TabContent: FC = () => {
  const {node, path} = useTabsLayoutRendererContext();
  const activeChild = node.children[node.activeTabIndex];

  if (!activeChild) {
    return null;
  }

  const activeTabId = getPanelId(activeChild);

  const currentPath = [...path, activeTabId];

  return (
    <NodeRenderer
      node={activeChild}
      path={currentPath}
      containerType="tabs"
      containerId={node.id}
    />
  );
};
