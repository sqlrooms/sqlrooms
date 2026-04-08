import {TabStrip} from '@sqlrooms/ui';
import {FC, useCallback} from 'react';
import {CollapseButton} from '../CollapseButton';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {TabLabel} from './TabLabel';
import {useTabsLayoutRendererContext} from './TabsLayoutRendererContext';

export const ExpandedTabStrip: FC = () => {
  const {onTabSelect, onTabClose, onTabReorder, onTabCreate, onCollapse} =
    useLayoutRendererContext();
  const {node, path, activeTabId, tabDescriptors, visibleTabIds} =
    useTabsLayoutRendererContext();

  const panelId = node.id;
  const showTabStrip = node.showTabStrip;
  const isCollapsible = node.collapsible;
  const closeableTabs = node.closeableTabs;
  const creatableTabs = node.creatableTabs;
  const searchableTabs = node.searchableTabs;

  const handleCollapse = useCallback(() => {
    onCollapse?.(panelId);
  }, [panelId, onCollapse]);

  const handleTabCreate = useCallback(() => {
    if (creatableTabs) {
      onTabCreate?.(panelId);
    }
  }, [panelId, onTabCreate, creatableTabs]);

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
      if (closeableTabs) {
        onTabClose?.(panelId, tabId);
      }
    },
    [panelId, onTabClose, closeableTabs],
  );

  const handleTabSelect = useCallback(
    (tabId: string) => {
      onTabSelect?.(panelId, tabId);
    },
    [panelId, onTabSelect],
  );

  if (!showTabStrip) {
    return (
      isCollapsible && (
        <div className="bg-background absolute right-0 rounded-md p-1">
          <CollapseButton onClick={handleCollapse} />
        </div>
      )
    );
  }

  return (
    <TabStrip
      tabs={tabDescriptors}
      openTabs={visibleTabIds}
      selectedTabId={activeTabId}
      preventCloseLastTab
      closeable={closeableTabs}
      onSelect={handleTabSelect}
      onClose={handleTabClose}
      onOpenTabsChange={handleOpenTabsChange}
      onCreate={handleTabCreate}
      renderTabLabel={(tab) => <TabLabel tab={tab} path={path} />}
    >
      {searchableTabs && <TabStrip.SearchDropdown />}
      <TabStrip.Tabs />
      {creatableTabs && <TabStrip.NewButton />}
      {isCollapsible && (
        <>
          <div className="flex-1" />
          <CollapseButton onClick={handleCollapse} />
        </>
      )}
    </TabStrip>
  );
};
