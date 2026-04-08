import {TabStrip} from '@sqlrooms/ui';
import React, {FC, useCallback} from 'react';
import {ExpandButton} from '../ExpandButton';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {TabLabel} from './TabLabel';
import {useTabsLayoutRendererContext} from './TabsLayoutRendererContext';

export const CollapsedTabStrip: FC = () => {
  const {onExpand} = useLayoutRendererContext();
  const {node, path, parentDirection, tabDescriptors, visibleTabIds} =
    useTabsLayoutRendererContext();

  const panelId = node.id;
  const showTabStripWhenCollapsed = node.showTabStripWhenCollapsed ?? false;

  const handleExpand = useCallback(() => {
    onExpand?.(panelId);
  }, [panelId, onExpand]);

  const handleTabSelect = useCallback(
    (tabId: string) => {
      onExpand?.(panelId, tabId);
    },
    [panelId, onExpand],
  );

  if (!showTabStripWhenCollapsed) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <ExpandButton direction={parentDirection} onClick={handleExpand} />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center">
      <TabStrip
        tabs={tabDescriptors}
        openTabs={visibleTabIds}
        preventCloseLastTab
        closeable={false}
        onSelect={handleTabSelect}
        renderTabLabel={(tab) => <TabLabel tab={tab} path={path} />}
      >
        <TabStrip.Tabs />
        <div className="flex-1" />
        <ExpandButton direction={parentDirection} onClick={handleExpand} />
      </TabStrip>
    </div>
  );
};
