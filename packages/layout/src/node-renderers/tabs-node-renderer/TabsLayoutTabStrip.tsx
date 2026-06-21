import {TabStrip, TabStripProps} from '@sqlrooms/ui';
import {FC, PropsWithChildren, useCallback, useMemo} from 'react';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {TabsLayoutTabLabel} from './TabsLayoutTabLabel';
import {useTabsNodeContext} from '../../LayoutNodeContext';
import {TabsLayoutToggleCollapseButton} from './TabsLayoutToggleCollapseButton';
import {useStoreWithLayout} from '../../LayoutSlice';
import {useTabDescriptors} from './useTabDescriptors';
import {
  getVisibleTabChildren,
  getChildrenIds,
  getLayoutNodeId,
  isLayoutTabsNode,
} from '@sqlrooms/layout-config';
import {findNodeById} from '../../layout-tree';

export type TabsLayoutTabStripProps = PropsWithChildren<Partial<TabStripProps>>;

export const TabsLayoutTabStrip: FC<TabsLayoutTabStripProps> = ({
  children,
  ...props
}) => {
  const {onTabSelect, onTabClose, onTabReorder, onTabCreate, onExpand} =
    useLayoutRendererContext();
  const {node, path} = useTabsNodeContext();

  // Subscribe to layout config changes (not stable getters)
  const layoutConfig = useStoreWithLayout((s) => s.layout.config);

  // Derive visible tabs and active tab from config
  const visibleTabIds = useMemo(() => {
    const found = findNodeById(layoutConfig, node.id);
    if (!found?.node || !isLayoutTabsNode(found.node)) {
      return [];
    }

    return getChildrenIds(getVisibleTabChildren(found.node));
  }, [layoutConfig, node.id]);

  const activeTabId = useMemo(() => {
    const found = findNodeById(layoutConfig, node.id);
    if (!found?.node || !isLayoutTabsNode(found.node)) {
      return undefined;
    }

    const visibleChildren = getVisibleTabChildren(found.node);
    const child = visibleChildren[found.node.activeTabIndex];
    return child != null ? getLayoutNodeId(child) : undefined;
  }, [layoutConfig, node.id]);

  const panelId = node.id;
  const isCollapsible = node.collapsible;

  const tabDescriptors = useTabDescriptors();

  const handleTabCreate = useCallback(() => {
    onExpand?.(panelId);
    onTabCreate?.(panelId);
  }, [panelId, onTabCreate, onExpand]);

  const handleOpenTabsChange = useCallback(
    (tabIds: string[]) => {
      const reopened = tabIds.find((id) => !visibleTabIds.includes(id));

      if (reopened) {
        onTabSelect?.(panelId, reopened);
      } else {
        onTabReorder?.(panelId, tabIds);
      }
    },
    [panelId, onTabSelect, onTabReorder, visibleTabIds],
  );

  const handleTabClose = useCallback(
    (tabId: string) => {
      onTabClose?.(panelId, tabId);
    },
    [panelId, onTabClose],
  );

  const handleTabSelect = useCallback(
    (tabId: string) => {
      onExpand?.(panelId);
      onTabSelect?.(panelId, tabId);
    },
    [panelId, onTabSelect, onExpand],
  );

  return (
    <TabStrip
      tabs={tabDescriptors}
      openTabs={visibleTabIds}
      selectedTabId={activeTabId}
      preventCloseLastTab={true}
      closeable={false}
      onSelect={handleTabSelect}
      onClose={handleTabClose}
      onOpenTabsChange={handleOpenTabsChange}
      onCreate={handleTabCreate}
      renderTabLabel={(tab) => <TabsLayoutTabLabel tab={tab} path={path} />}
      {...props}
    >
      {children}
      {isCollapsible && (
        <>
          <div className="flex-1" />
          <TabsLayoutToggleCollapseButton />
        </>
      )}
    </TabStrip>
  );
};
