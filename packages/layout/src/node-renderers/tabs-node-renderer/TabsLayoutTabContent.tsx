import {getLayoutNodeId, getVisibleTabChildren} from '@sqlrooms/layout-config';
import {FC, useMemo} from 'react';
import {useRenderNode} from '../RenderNodeContext';
import {useActiveTab} from './useActiveTab';
import {useTabsNodeContext} from '../../LayoutNodeContext';

export interface TabsLayoutTabContentProps {
  /**
   * Keep all visible tab contents mounted and hide inactive tabs.
   *
   * This is useful for expensive panels that should preserve their local state
   * or setup work while the user switches between tabs.
   */
  forceMount?: boolean;
}

export const TabsLayoutTabContent: FC<TabsLayoutTabContentProps> = ({
  forceMount = false,
}) => {
  const {container, node, path} = useActiveTab();
  const {node: tabsNode, path: tabsPath} = useTabsNodeContext();
  const renderNode = useRenderNode();

  const visibleChildren = useMemo(
    () => getVisibleTabChildren(tabsNode),
    [tabsNode],
  );

  if (!node || !path) {
    return null;
  }

  if (forceMount) {
    return (
      <>
        {visibleChildren.map((child, index) => {
          const childId = getLayoutNodeId(child);
          const childPath = [...tabsPath, childId];
          const isActive = index === tabsNode.activeTabIndex;

          return (
            <div
              key={childId}
              className="min-h-0 flex-1 flex-col overflow-hidden"
              style={{display: isActive ? 'flex' : 'none'}}
            >
              {renderNode({
                node: child,
                path: childPath,
                containerType: 'tabs',
                containerId: tabsNode.id,
              })}
            </div>
          );
        })}
      </>
    );
  }

  return renderNode({
    node,
    path,
    containerType: 'tabs',
    containerId: container.id,
  });
};
