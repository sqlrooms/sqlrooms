import {FC} from 'react';
import {useRenderNode} from '../RenderNodeContext';
import {useActiveTab} from './useActiveTab';

export const TabsLayoutTabContent: FC = () => {
  const {container, node, path} = useActiveTab();
  const renderNode = useRenderNode();

  if (!node || !path) {
    return null;
  }

  return renderNode({
    node,
    path,
    containerType: 'tabs',
    containerId: container.id,
  });
};
