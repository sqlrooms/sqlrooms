import {LayoutTabsNode} from '@sqlrooms/layout-config';
import {Button, TabDescriptor, TabStrip} from '@sqlrooms/ui';
import {ChevronsRightIcon, ChevronsUpIcon, XIcon} from 'lucide-react';
import {FC, useCallback, useMemo} from 'react';
import {getChildKey, MOSAIC_NODE_KEY_PREFIX} from '../mosaic/mosaic-utils';
import {NodeRenderer} from './NodeRenderer';
import {lookupPanelInfo, NodeRenderProps} from './types';

// ---------------------------------------------------------------------------
// Small shared buttons
// ---------------------------------------------------------------------------

function CollapseButton({onClick}: {onClick: () => void}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="hover:bg-primary/10 h-7 w-7 shrink-0"
      onClick={onClick}
      aria-label="Collapse"
    >
      <XIcon className="h-3.5 w-3.5" />
    </Button>
  );
}

function ExpandButton({
  direction,
  onClick,
}: {
  direction?: 'row' | 'column';
  onClick: () => void;
}) {
  const Icon =
    direction === 'column'
      ? ChevronsUpIcon
      : direction === 'row'
        ? ChevronsRightIcon
        : ChevronsRightIcon;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="hover:bg-primary/10 h-7 w-7 shrink-0"
      onClick={onClick}
      aria-label="Expand"
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}

// ---------------------------------------------------------------------------
// TabsRenderer
// ---------------------------------------------------------------------------

export const TabsRenderer: FC<
  Omit<NodeRenderProps, 'node'> & {node: LayoutTabsNode}
> = ({
  node,
  path,
  parentDirection,
  panels,
  rootLayout,
  resolvePanel,
  renderPanel,
  renderTabStrip: renderTabStripOverride,
  resolvePanelInfo,
  onLayoutChange,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onTabCreate,
  onAreaCollapse,
  onAreaExpand,
}) => {
  const areaId = node.id;
  const showTabStrip = node.showTabStrip !== false;
  const isCollapsed = node.collapsed === true;
  const isCollapsible = node.collapsible === true;
  const closeableTabs = node.closeableTabs === true;
  const creatableTabs = node.creatableTabs === true;
  const searchableTabs = node.searchableTabs === true;

  const tabKeys = useMemo(
    () =>
      node.children
        .map((c) => getChildKey(c))
        .filter((k): k is string => k != null),
    [node.children],
  );

  const activeChild = node.children[node.activeTabIndex];
  const activeTabId = tabKeys[node.activeTabIndex];

  const resolveTabName = useCallback(
    (id: string): string => {
      if (id.startsWith(MOSAIC_NODE_KEY_PREFIX)) {
        const mosaicId = id.slice(MOSAIC_NODE_KEY_PREFIX.length);
        return (
          lookupPanelInfo(mosaicId, panels, resolvePanel, resolvePanelInfo)
            ?.title ?? mosaicId
        );
      }
      return (
        lookupPanelInfo(id, panels, resolvePanel, resolvePanelInfo)?.title ?? id
      );
    },
    [panels, resolvePanel, resolvePanelInfo],
  );

  const allAreaPanelIds = useMemo(() => {
    const ids = [...tabKeys];
    if (areaId) {
      for (const [id, info] of Object.entries(panels)) {
        if (
          (info.area ?? (info as Record<string, unknown>).placement) ===
            areaId &&
          !ids.includes(id)
        ) {
          ids.push(id);
        }
      }
    }
    return ids;
  }, [tabKeys, areaId, panels]);

  const tabDescriptors: TabDescriptor[] = useMemo(
    () => allAreaPanelIds.map((id) => ({id, name: resolveTabName(id)})),
    [allAreaPanelIds, resolveTabName],
  );

  const renderTabLabel = useCallback(
    (tab: TabDescriptor) => {
      let panelId = tab.id;
      if (panelId.startsWith(MOSAIC_NODE_KEY_PREFIX)) {
        panelId = panelId.slice(MOSAIC_NODE_KEY_PREFIX.length);
      }
      const Icon = lookupPanelInfo(
        panelId,
        panels,
        resolvePanel,
        resolvePanelInfo,
      )?.icon;
      return (
        <span className="flex items-center gap-1.5 truncate">
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />}
          <span className="truncate">{tab.name}</span>
        </span>
      );
    },
    [panels, resolvePanel, resolvePanelInfo],
  );

  if (renderTabStripOverride) {
    const override = renderTabStripOverride({node, path});
    if (override !== undefined) {
      return <>{override}</>;
    }
  }

  // Collapsed state: show expand button (with optional tab strip)
  if (isCollapsed) {
    if (!node.showTabStripWhenCollapsed) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <ExpandButton
            direction={parentDirection}
            onClick={() => areaId && onAreaExpand?.(areaId)}
          />
        </div>
      );
    }

    return (
      <div className="flex h-full w-full items-center">
        <TabStrip
          tabs={tabDescriptors}
          openTabs={tabKeys}
          selectedTabId={undefined}
          preventCloseLastTab
          closeable={false}
          onSelect={(tabId) => {
            if (areaId) {
              onAreaExpand?.(areaId, tabId);
            }
          }}
          renderTabLabel={renderTabLabel}
        >
          <TabStrip.Tabs />
          <div className="flex-1" />
          <ExpandButton
            direction={parentDirection}
            onClick={() => areaId && onAreaExpand?.(areaId)}
          />
        </TabStrip>
      </div>
    );
  }

  const tabStripContent = showTabStrip ? (
    <TabStrip
      tabs={tabDescriptors}
      openTabs={tabKeys}
      selectedTabId={activeTabId}
      preventCloseLastTab
      closeable={closeableTabs}
      onSelect={(tabId) => {
        if (areaId) onTabSelect?.(areaId, tabId);
      }}
      onClose={
        closeableTabs
          ? (tabId) => {
              if (areaId) onTabClose?.(areaId, tabId);
            }
          : undefined
      }
      onOpenTabsChange={(tabIds) => {
        if (areaId) onTabReorder?.(areaId, tabIds);
      }}
      onCreate={
        creatableTabs && areaId ? () => onTabCreate?.(areaId) : undefined
      }
      renderTabLabel={renderTabLabel}
    >
      {searchableTabs && <TabStrip.SearchDropdown />}
      <TabStrip.Tabs />
      {creatableTabs && <TabStrip.NewButton />}
      {isCollapsible && areaId && (
        <>
          <div className="flex-1" />
          <CollapseButton onClick={() => onAreaCollapse?.(areaId)} />
        </>
      )}
    </TabStrip>
  ) : isCollapsible && areaId ? (
    <div className="bg-background absolute right-0 rounded-md p-1">
      <CollapseButton onClick={() => onAreaCollapse?.(areaId)} />
    </div>
  ) : null;

  return (
    <div className="relative flex h-full w-full flex-col">
      {tabStripContent}
      <div className="min-h-0 flex-1">
        {activeChild != null && (
          <NodeRenderer
            node={activeChild}
            path={[...path, activeTabId ?? node.activeTabIndex]}
            containerType="tabs"
            containerId={areaId}
            panels={panels}
            rootLayout={rootLayout}
            resolvePanel={resolvePanel}
            renderPanel={renderPanel}
            renderTabStrip={renderTabStripOverride}
            resolvePanelInfo={resolvePanelInfo}
            onLayoutChange={onLayoutChange}
            onTabSelect={onTabSelect}
            onTabClose={onTabClose}
            onTabReorder={onTabReorder}
            onTabCreate={onTabCreate}
            onAreaCollapse={onAreaCollapse}
            onAreaExpand={onAreaExpand}
          />
        )}
      </div>
    </div>
  );
};
