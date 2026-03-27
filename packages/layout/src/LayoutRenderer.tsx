import React, {FC, useCallback, useEffect, useMemo, useRef} from 'react';
import {
  Group,
  Panel,
  Separator,
  type PanelImperativeHandle,
  type PanelSize,
} from 'react-resizable-panels';
import {
  Mosaic,
  MosaicNode,
  MosaicPath,
  MosaicWindow,
} from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import {
  isLayoutSplitNode,
  isLayoutTabsNode,
  isLayoutMosaicNode,
  isLayoutPanelNode,
  LayoutNode,
  LayoutTabsNode,
  LayoutSplitNode,
  LayoutMosaicNode,
} from '@sqlrooms/layout-config';
import {TabStrip, TabDescriptor, cn, Button} from '@sqlrooms/ui';
import {
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ChevronsUpIcon,
  ChevronsDownIcon,
  XIcon,
} from 'lucide-react';
import {
  getChildKey,
  MOSAIC_NODE_KEY_PREFIX,
  convertToMosaicTree,
  convertFromMosaicTree,
  updateMosaicSubtree,
} from './mosaic/mosaic-utils';
import type {
  RoomPanelInfo,
  PanelRenderContext,
  TabStripRenderContext,
} from './LayoutSlice';

// ---------------------------------------------------------------------------
// Mosaic-specific styles (only applied inside nested mosaic containers)
// ---------------------------------------------------------------------------

const mosaicStyles = `
  .mosaic-split {
    background-color: hsl(var(--border) / 0.2);
  }
  .mosaic-split:hover {
    background-color: hsl(var(--primary) / 0.4);
  }
  .mosaic-root {
    top: 0; left: 0; right: 0; bottom: 0;
  }
  .mosaic-tile {
    margin: 0;
  }
  .mosaic-tabs-toolbar {
    display: none !important;
  }
`;

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface LayoutRendererProps {
  layout: LayoutNode | null;
  panels: Record<string, RoomPanelInfo>;
  className?: string;
  renderPanel?: (context: PanelRenderContext) => React.ReactNode | undefined;
  renderTabStrip?: (
    context: TabStripRenderContext,
  ) => React.ReactNode | undefined;
  resolvePanelInfo?: (panelId: string) => RoomPanelInfo | undefined;
  onLayoutChange?: (layout: LayoutNode | null) => void;
  onTabSelect?: (areaId: string, tabId: string) => void;
  onTabClose?: (areaId: string, tabId: string) => void;
  onTabReorder?: (areaId: string, tabIds: string[]) => void;
  onTabCreate?: (areaId: string) => void;
  onAreaCollapse?: (areaId: string) => void;
  onAreaExpand?: (areaId: string, panelId?: string) => void;
}

// ---------------------------------------------------------------------------
// Main LayoutRenderer
// ---------------------------------------------------------------------------

const LayoutRenderer: FC<LayoutRendererProps> = ({
  layout,
  panels,
  className,
  renderPanel,
  renderTabStrip,
  resolvePanelInfo,
  onLayoutChange,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onTabCreate,
  onAreaCollapse,
  onAreaExpand,
}) => {
  if (!layout) return null;

  return (
    <div className={cn('h-full w-full', className)}>
      <NodeRenderer
        node={layout}
        path={[]}
        containerType="root"
        panels={panels}
        rootLayout={layout}
        renderPanel={renderPanel}
        renderTabStrip={renderTabStrip}
        resolvePanelInfo={resolvePanelInfo}
        onLayoutChange={onLayoutChange}
        onTabSelect={onTabSelect}
        onTabClose={onTabClose}
        onTabReorder={onTabReorder}
        onTabCreate={onTabCreate}
        onAreaCollapse={onAreaCollapse}
        onAreaExpand={onAreaExpand}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Internal context threaded through the tree
// ---------------------------------------------------------------------------

interface NodeRenderProps {
  node: LayoutNode;
  path: number[];
  containerType: PanelRenderContext['containerType'];
  containerId?: string;
  /** Direction of the parent split, used for expand button icon orientation */
  parentDirection?: 'row' | 'column';
  panels: Record<string, RoomPanelInfo>;
  rootLayout: LayoutNode;
  renderPanel?: (context: PanelRenderContext) => React.ReactNode | undefined;
  renderTabStrip?: (
    context: TabStripRenderContext,
  ) => React.ReactNode | undefined;
  resolvePanelInfo?: (panelId: string) => RoomPanelInfo | undefined;
  onLayoutChange?: (layout: LayoutNode | null) => void;
  onTabSelect?: (areaId: string, tabId: string) => void;
  onTabClose?: (areaId: string, tabId: string) => void;
  onTabReorder?: (areaId: string, tabIds: string[]) => void;
  onTabCreate?: (areaId: string) => void;
  onAreaCollapse?: (areaId: string) => void;
  onAreaExpand?: (areaId: string, panelId?: string) => void;
}

/**
 * Resolve panel info by checking the static panels registry first,
 * then falling back to the resolvePanelInfo callback.
 */
function lookupPanelInfo(
  panelId: string,
  panels: Record<string, RoomPanelInfo>,
  resolvePanelInfo?: (panelId: string) => RoomPanelInfo | undefined,
): RoomPanelInfo | undefined {
  return panels[panelId] ?? resolvePanelInfo?.(panelId);
}

// ---------------------------------------------------------------------------
// Recursive node renderer
// ---------------------------------------------------------------------------

const NodeRenderer: FC<NodeRenderProps> = ({node, ...rest}) => {
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
// Leaf panel renderer
// ---------------------------------------------------------------------------

const LeafRenderer: FC<Omit<NodeRenderProps, 'node'> & {panelId: string}> = ({
  panelId,
  path,
  containerType,
  containerId,
  panels,
  resolvePanelInfo,
  renderPanel: renderPanelOverride,
}) => {
  const context: PanelRenderContext = {
    panelId,
    containerType,
    containerId,
    path,
  };

  if (renderPanelOverride) {
    const override = renderPanelOverride(context);
    if (override !== undefined) {
      return <>{override}</>;
    }
  }

  const info = lookupPanelInfo(panelId, panels, resolvePanelInfo);
  if (!info?.component) return null;

  const PanelComp = info.component;
  return (
    <div className="h-full w-full overflow-hidden p-2">
      <PanelComp {...context} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Size constraint helpers
// ---------------------------------------------------------------------------

function getSizeProps(node: LayoutNode) {
  if (typeof node === 'string') return {};
  const result: Record<string, unknown> = {};
  if ('defaultSize' in node && node.defaultSize != null)
    result.defaultSize = node.defaultSize;
  if ('minSize' in node && node.minSize != null) result.minSize = node.minSize;
  if ('maxSize' in node && node.maxSize != null) result.maxSize = node.maxSize;
  if ('collapsedSize' in node && node.collapsedSize != null)
    result.collapsedSize = node.collapsedSize;
  if ('collapsible' in node && node.collapsible != null)
    result.collapsible = node.collapsible;
  return result;
}

function getPanelId(node: LayoutNode, index: number): string {
  if (typeof node === 'string') return node;
  if ('id' in node && node.id) return node.id;
  return `panel-${index}`;
}

// ---------------------------------------------------------------------------
// Split renderer — uses react-resizable-panels Group/Panel/Separator
// ---------------------------------------------------------------------------

/**
 * Determine if a child node wants to be collapsed.
 * Only tabs nodes have a `collapsed` flag.
 */
function isChildCollapsed(child: LayoutNode): boolean {
  return isLayoutTabsNode(child) && child.collapsed === true;
}

/**
 * Determine if a child node is collapsible.
 */
function isChildCollapsible(child: LayoutNode): boolean {
  if (typeof child === 'string') return false;
  return 'collapsible' in child && child.collapsible === true;
}

/**
 * Get the area id for a child node (if it's a tabs or mosaic node with an id).
 */
function getChildAreaId(child: LayoutNode): string | undefined {
  if (typeof child === 'string') return undefined;
  if ('id' in child) return child.id;
  return undefined;
}

/**
 * Default minSize for collapsible panels that don't specify one.
 * This ensures react-resizable-panels snaps between collapsed and expanded
 * states instead of allowing intermediate sizes.
 */
const DEFAULT_COLLAPSIBLE_MIN_SIZE = '10%';

/**
 * Panel wrapper that syncs the collapsed state from the layout config
 * with react-resizable-panels' imperative collapse/expand API.
 */
const CollapsiblePanelWrapper: FC<{
  id: string;
  collapsed: boolean;
  collapsible: boolean;
  collapsedSize?: number | string;
  defaultSize?: number | string;
  minSize?: number | string;
  maxSize?: number | string;
  areaId?: string;
  onAreaExpand?: (areaId: string, panelId?: string) => void;
  onAreaCollapse?: (areaId: string) => void;
  children: React.ReactNode;
}> = ({
  id,
  collapsed,
  collapsible,
  collapsedSize,
  defaultSize,
  minSize,
  maxSize,
  areaId,
  onAreaExpand,
  onAreaCollapse,
  children,
}) => {
  const panelRef = useRef<PanelImperativeHandle | null>(null);

  useEffect(() => {
    const handle = panelRef.current;
    if (!handle) return;
    if (collapsed && !handle.isCollapsed()) {
      handle.collapse();
    } else if (!collapsed && handle.isCollapsed()) {
      handle.expand();
    }
  }, [collapsed]);

  const handleResize = useCallback(
    (
      _panelSize: PanelSize,
      _id: string | number | undefined,
      _prevSize: PanelSize | undefined,
    ) => {
      if (!areaId) return;
      const handle = panelRef.current;
      if (!handle) return;
      if (collapsed && !handle.isCollapsed()) {
        onAreaExpand?.(areaId);
      } else if (!collapsed && handle.isCollapsed()) {
        onAreaCollapse?.(areaId);
      }
    },
    [areaId, collapsed, onAreaExpand, onAreaCollapse],
  );

  const effectiveMinSize =
    minSize ?? (collapsible ? DEFAULT_COLLAPSIBLE_MIN_SIZE : undefined);

  return (
    <Panel
      id={id}
      panelRef={panelRef}
      collapsible={collapsible}
      collapsedSize={collapsedSize ?? 0}
      defaultSize={defaultSize}
      minSize={effectiveMinSize}
      maxSize={maxSize}
      onResize={handleResize}
    >
      {children}
    </Panel>
  );
};

const SplitRenderer: FC<
  Omit<NodeRenderProps, 'node'> & {node: LayoutSplitNode}
> = ({
  node,
  path,
  panels,
  rootLayout,
  renderPanel,
  renderTabStrip,
  onLayoutChange,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onTabCreate,
  onAreaCollapse,
  onAreaExpand,
}) => {
  const orientation = node.direction === 'column' ? 'vertical' : 'horizontal';

  return (
    <Group orientation={orientation}>
      {node.children.map((child, i) => {
        const key = getPanelId(child, i);
        const sizeProps = getSizeProps(child);
        const isLast = i === node.children.length - 1;
        const collapsible = isChildCollapsible(child);
        const collapsed = isChildCollapsed(child);
        const areaId = getChildAreaId(child);

        const childContent = (
          <NodeRenderer
            node={child}
            path={[...path, i]}
            containerType="split"
            containerId={node.id}
            parentDirection={node.direction}
            panels={panels}
            rootLayout={rootLayout}
            renderPanel={renderPanel}
            renderTabStrip={renderTabStrip}
            onLayoutChange={onLayoutChange}
            onTabSelect={onTabSelect}
            onTabClose={onTabClose}
            onTabReorder={onTabReorder}
            onTabCreate={onTabCreate}
            onAreaCollapse={onAreaCollapse}
            onAreaExpand={onAreaExpand}
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
            onAreaExpand={onAreaExpand}
            onAreaCollapse={onAreaCollapse}
          >
            {childContent}
          </CollapsiblePanelWrapper>
        ) : (
          <Panel id={key} {...sizeProps}>
            {childContent}
          </Panel>
        );

        return (
          <React.Fragment key={key}>
            {panelElement}
            {!isLast && (
              <Separator className="bg-border/20 hover:bg-primary/40 data-[resize-handle-active]:bg-primary/60 transition-colors" />
            )}
          </React.Fragment>
        );
      })}
    </Group>
  );
};

// ---------------------------------------------------------------------------
// Tabs renderer — TabStrip + active child
// ---------------------------------------------------------------------------

const TabsRenderer: FC<
  Omit<NodeRenderProps, 'node'> & {node: LayoutTabsNode}
> = ({
  node,
  path,
  parentDirection,
  panels,
  rootLayout,
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
          lookupPanelInfo(mosaicId, panels, resolvePanelInfo)?.title ?? mosaicId
        );
      }
      return lookupPanelInfo(id, panels, resolvePanelInfo)?.title ?? id;
    },
    [panels, resolvePanelInfo],
  );

  // Build tab descriptors for the strip
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
      const Icon = lookupPanelInfo(panelId, panels, resolvePanelInfo)?.icon;
      return (
        <span className="flex items-center gap-1.5 truncate">
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />}
          <span className="truncate">{tab.name}</span>
        </span>
      );
    },
    [panels, resolvePanelInfo],
  );

  // Allow render override for the entire tab strip
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
        <CollapseButton onClick={() => onAreaCollapse?.(areaId)} />
      )}
    </TabStrip>
  ) : isCollapsible && areaId ? (
    <div className="flex h-7 items-center justify-end px-1">
      <CollapseButton onClick={() => onAreaCollapse?.(areaId)} />
    </div>
  ) : null;

  return (
    <div className="flex h-full w-full flex-col">
      {tabStripContent}
      <div className="min-h-0 flex-1">
        {activeChild != null && (
          <NodeRenderer
            node={activeChild}
            path={[...path, node.activeTabIndex]}
            containerType="tabs"
            containerId={areaId}
            panels={panels}
            rootLayout={rootLayout}
            renderPanel={renderPanel}
            renderTabStrip={renderTabStripOverride}
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

// ---------------------------------------------------------------------------
// Mosaic renderer — delegates to react-mosaic-component for drag-and-drop
// ---------------------------------------------------------------------------

const MosaicRenderer: FC<
  Omit<NodeRenderProps, 'node'> & {node: LayoutMosaicNode}
> = ({
  node,
  panels,
  rootLayout,
  renderPanel,
  resolvePanelInfo,
  onLayoutChange,
}) => {
  const treeRef = useRef(node.nodes);
  useEffect(() => {
    treeRef.current = node.nodes;
  }, [node.nodes]);

  const mosaicValue = useMemo(
    () => convertToMosaicTree(node.nodes),
    [node.nodes],
  );

  const handleChange = useCallback(
    (newMosaicNodes: MosaicNode<string> | null) => {
      const restored = convertFromMosaicTree(newMosaicNodes, treeRef.current);
      const updated = updateMosaicSubtree(rootLayout, node.id, restored);
      onLayoutChange?.(updated);
    },
    [rootLayout, node.id, onLayoutChange],
  );

  const draggable = node.draggable !== false;

  const renderTile = useCallback(
    (panelId: string, tilePath: MosaicPath) => {
      const context: PanelRenderContext = {
        panelId,
        containerType: 'mosaic',
        containerId: node.id,
        path: tilePath,
      };

      if (renderPanel) {
        const override = renderPanel(context);
        if (override !== undefined) {
          return <>{override}</>;
        }
      }

      const info = lookupPanelInfo(panelId, panels, resolvePanelInfo);
      if (!info?.component) return <></>;

      const PanelComp = info.component;
      const body = (
        <div className="h-full w-full overflow-hidden p-2">
          <PanelComp {...context} />
        </div>
      );

      if (!draggable) return body;

      return (
        <MosaicWindow<string>
          title={info.title ?? panelId}
          path={tilePath}
          draggable
        >
          {body}
        </MosaicWindow>
      );
    },
    [panels, renderPanel, resolvePanelInfo, draggable, node.id],
  );

  return (
    <div className="relative h-full w-full">
      <style>{mosaicStyles}</style>
      <Mosaic<string>
        value={mosaicValue}
        onChange={handleChange}
        renderTile={renderTile}
        className=""
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shared small components
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

export default LayoutRenderer;
