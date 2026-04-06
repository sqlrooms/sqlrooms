import {
  isLayoutMosaicNode,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutSplitNode,
  LayoutTabsNode,
} from '@sqlrooms/layout-config';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  TabDescriptor,
  TabStrip,
} from '@sqlrooms/ui';
import React, {FC, useCallback, useMemo} from 'react';
import {getChildKey, MOSAIC_NODE_KEY_PREFIX} from '../mosaic/mosaic-utils';
import {CollapseButton, CollapsiblePanelWrapper, ExpandButton} from './helpers';
import {LeafRenderer} from './LeafRenderer';
import {MosaicRenderer} from './MosaicRenderer';
import {
  getChildAreaId,
  getPanelId,
  getSizeProps,
  isChildCollapsed,
  isChildCollapsible,
  lookupPanelInfo,
  type NodeRenderProps,
} from './types';

// ---------------------------------------------------------------------------
// NodeRenderer – recursive dispatcher
// ---------------------------------------------------------------------------

export const NodeRenderer: FC<NodeRenderProps> = ({node, ...rest}) => {
  if (typeof node === 'string') {
    return <LeafRenderer panelId={node} {...rest} />;
  }
  if (isLayoutPanelNode(node)) {
    return <LeafRenderer panelId={node.id} {...rest} />;
  }
  if (isLayoutSplitNode(node)) {
    return <SplitRenderer node={node} {...rest} />;
  }
  if (isLayoutTabsNode(node)) {
    return <TabsRenderer node={node} {...rest} />;
  }
  if (isLayoutMosaicNode(node)) {
    return <MosaicRenderer node={node} {...rest} />;
  }
  return null;
};

// ---------------------------------------------------------------------------
// SplitRenderer
// ---------------------------------------------------------------------------

const SplitRenderer: FC<
  Omit<NodeRenderProps, 'node'> & {node: LayoutSplitNode}
> = ({
  node,
  path,
  panels,
  rootLayout,
  renderTabStrip,
  onLayoutChange,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onTabCreate,
  onCollapse,
  onExpand,
}) => {
  const orientation = node.direction === 'column' ? 'vertical' : 'horizontal';

  return (
    <ResizablePanelGroup orientation={orientation}>
      {node.children.map((child, i) => {
        const key = getPanelId(child, i);
        const sizeProps = getSizeProps(child);
        const isLast = i === node.children.length - 1;
        const collapsible = isChildCollapsible(child);
        const collapsed = isChildCollapsed(child);
        const areaId = getChildAreaId(child);
        const childPathSegment = areaId ?? key ?? i;

        const childContent = (
          <NodeRenderer
            node={child}
            path={[...path, childPathSegment]}
            containerType="split"
            containerId={node.id}
            parentDirection={node.direction}
            panels={panels}
            rootLayout={rootLayout}
            renderTabStrip={renderTabStrip}
            onLayoutChange={onLayoutChange}
            onTabSelect={onTabSelect}
            onTabClose={onTabClose}
            onTabReorder={onTabReorder}
            onTabCreate={onTabCreate}
            onCollapse={onCollapse}
            onExpand={onExpand}
          />
        );

        const panelElement = collapsible ? (
          <CollapsiblePanelWrapper
            id={key}
            collapsed={collapsed}
            collapsible
            collapsedSize={
              sizeProps.collapsedSize as string | number | undefined
            }
            defaultSize={sizeProps.defaultSize as string | number | undefined}
            minSize={sizeProps.minSize as string | number | undefined}
            maxSize={sizeProps.maxSize as string | number | undefined}
            areaId={areaId}
            onExpand={onExpand}
            onCollapse={onCollapse}
          >
            {childContent}
          </CollapsiblePanelWrapper>
        ) : (
          <ResizablePanel id={key} {...sizeProps}>
            {childContent}
          </ResizablePanel>
        );

        return (
          <React.Fragment key={key}>
            {panelElement}
            {!isLast && (
              <ResizableHandle className="bg-border hover:bg-primary/60 transition-colors" />
            )}
          </React.Fragment>
        );
      })}
    </ResizablePanelGroup>
  );
};

// ---------------------------------------------------------------------------
// TabsRenderer
// ---------------------------------------------------------------------------

const TabsRenderer: FC<
  Omit<NodeRenderProps, 'node'> & {node: LayoutTabsNode}
> = ({
  node,
  path,
  parentDirection,
  panels,
  rootLayout,
  renderTabStrip: renderTabStripOverride,
  onLayoutChange,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onTabCreate,
  onCollapse,
  onExpand,
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
      const ctx = {
        panelId: id,
        containerType: 'tabs' as const,
        containerId: areaId,
        path,
      };
      if (id.startsWith(MOSAIC_NODE_KEY_PREFIX)) {
        const mosaicId = id.slice(MOSAIC_NODE_KEY_PREFIX.length);
        return (
          lookupPanelInfo({...ctx, panelId: mosaicId}, panels)?.title ??
          mosaicId
        );
      }
      return lookupPanelInfo(ctx, panels)?.title ?? id;
    },
    [panels, areaId, path],
  );

  const allAreaPanelIds = useMemo(() => {
    const ids = [...tabKeys];
    if (node.closedChildren) {
      for (const id of node.closedChildren) {
        if (!ids.includes(id)) {
          ids.push(id);
        }
      }
    }
    return ids;
  }, [tabKeys, node.closedChildren]);

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
        {panelId, containerType: 'tabs', containerId: areaId, path},
        panels,
      )?.icon;
      return (
        <span className="flex items-center gap-1.5 truncate">
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />}
          <span className="truncate">{tab.name}</span>
        </span>
      );
    },
    [panels, areaId, path],
  );

  if (renderTabStripOverride) {
    const override = renderTabStripOverride({node, path});
    if (override !== undefined) {
      return <>{override}</>;
    }
  }

  if (isCollapsed) {
    if (!node.showTabStripWhenCollapsed) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <ExpandButton
            direction={parentDirection}
            onClick={() => areaId && onExpand?.(areaId)}
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
              onExpand?.(areaId, tabId);
            }
          }}
          renderTabLabel={renderTabLabel}
        >
          <TabStrip.Tabs />
          <div className="flex-1" />
          <ExpandButton
            direction={parentDirection}
            onClick={() => areaId && onExpand?.(areaId)}
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
        if (!areaId) return;
        const reopened = tabIds.find((id) => !tabKeys.includes(id));
        if (reopened) {
          onTabSelect?.(areaId, reopened);
        } else {
          onTabReorder?.(areaId, tabIds);
        }
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
          <CollapseButton onClick={() => onCollapse?.(areaId)} />
        </>
      )}
    </TabStrip>
  ) : isCollapsible && areaId ? (
    <div className="bg-background absolute right-0 rounded-md p-1">
      <CollapseButton onClick={() => onCollapse?.(areaId)} />
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
            renderTabStrip={renderTabStripOverride}
            onLayoutChange={onLayoutChange}
            onTabSelect={onTabSelect}
            onTabClose={onTabClose}
            onTabReorder={onTabReorder}
            onTabCreate={onTabCreate}
            onCollapse={onCollapse}
            onExpand={onExpand}
          />
        )}
      </div>
    </div>
  );
};
