import React, {FC, useCallback, useEffect, useMemo, useRef} from 'react';
import {
  Mosaic,
  MosaicNode,
  MosaicPath,
  MosaicProps,
  TabToolbarRenderer,
} from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import {
  isMosaicLayoutTabsNode,
  isMosaicLayoutSplitNode,
  MosaicLayoutTabsNode,
  MosaicLayoutNode,
} from '@sqlrooms/layout-config';
import {TabStrip, TabDescriptor, cn, Button} from '@sqlrooms/ui';
import {
  XIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from 'lucide-react';
import MosaicTile from './MosaicTile';
import {
  getNodeAtPath,
  findCollapsedSiblings,
  findParentArea,
  findMosaicNodeById,
  convertToMosaicTree,
  convertFromMosaicTree,
  updateMosaicSubtree,
  MOSAIC_NODE_KEY_PREFIX,
  ExpandDirection,
  CollapsedAreaInfo,
} from './mosaic-utils';
import {RoomPanelInfo} from '../LayoutSlice';

const customMosaicStyles = `
  .mosaic-split {
    background-color: hsl(var(--border) / 0.2);
  }
  .mosaic-split:hover {
    background-color: hsl(var(--primary) / 0.4);
  }
  .mosaic-root {
    top: 0px;
    left: 0px;
    right: 0px;
    bottom: 0px;
  }
  .mosaic-tile {
    margin: 0;
  }
  .mosaic-tabs-toolbar {
    display: none !important;
  }
`;

const CHEVRON_ICONS: Record<
  ExpandDirection,
  React.ComponentType<{className?: string}>
> = {
  right: ChevronRightIcon,
  left: ChevronLeftIcon,
  down: ChevronDownIcon,
  up: ChevronUpIcon,
};

export interface MosaicLayoutProps {
  tileClassName?: string;
  panels?: Record<string, RoomPanelInfo>;
  /** When true, all tiles in this mosaic are draggable (used for nested mosaics) */
  forceDraggable?: boolean;
  onTabSelect?: (path: MosaicPath, tabId: string) => void;
  onTabClose?: (path: MosaicPath, tabId: string) => void;
  onTabReorder?: (path: MosaicPath, tabIds: string[]) => void;
  onTabCreate?: (areaId: string) => void;
  onAreaCollapse?: (areaId: string) => void;
  onAreaExpand?: (areaId: string, panelId?: string) => void;
}

type CombinedProps = MosaicProps<string> & MosaicLayoutProps;

const UNCOLLAPSE_THRESHOLD = 8;

const MosaicLayout: FC<CombinedProps> = (props) => {
  const {
    onChange,
    onRelease,
    renderTile,
    tileClassName,
    panels,
    forceDraggable,
    onTabSelect,
    onTabClose,
    onTabReorder,
    onTabCreate,
    onAreaCollapse,
    onAreaExpand,
  } = props;
  const [isDragging, setDragging] = React.useState(false);
  const currentValue = 'value' in props ? props.value : undefined;
  const treeRef = useRef(currentValue);
  useEffect(() => {
    treeRef.current = currentValue;
  }, [currentValue]);

  const mosaicValue = useMemo(
    () => convertToMosaicTree(currentValue as MosaicLayoutNode | null),
    [currentValue],
  );

  const handleLayoutChange = useCallback(
    (nodes: MosaicNode<string> | null) => {
      setDragging(true);
      const restored = convertFromMosaicTree(
        nodes,
        treeRef.current as MosaicLayoutNode | null,
      );
      onChange?.(restored as MosaicNode<string> | null);
    },
    [onChange],
  );

  const handleLayoutRelease = useCallback(
    (newNode: MosaicNode<string> | null) => {
      setDragging(false);

      const restored = convertFromMosaicTree(
        newNode,
        treeRef.current as MosaicLayoutNode | null,
      ) as MosaicLayoutNode | null;

      if (restored) {
        checkResizeUncollapse(restored, onAreaExpand);
      }

      onRelease?.(restored as MosaicNode<string> | null);
    },
    [onRelease, onAreaExpand],
  );

  const handleNestedMosaicChange = useCallback(
    (mosaicId: string, newNodes: MosaicLayoutNode | null) => {
      const updated = updateMosaicSubtree(
        currentValue as MosaicLayoutNode | null,
        mosaicId,
        newNodes,
      );
      onChange?.(updated as MosaicNode<string> | null);
    },
    [currentValue, onChange],
  );

  const renderTabLabel = useCallback(
    (tab: TabDescriptor) => {
      const Icon = panels?.[tab.id]?.icon;
      return (
        <span className="flex items-center gap-1.5 truncate">
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />}
          <span className="truncate">{tab.name}</span>
        </span>
      );
    },
    [panels],
  );

  const renderTabToolbar: TabToolbarRenderer<string> = useCallback(
    ({tabs, activeTabIndex, path}) => {
      const areaNode = currentValue
        ? getNodeAtPath(currentValue as MosaicLayoutNode, path)
        : undefined;

      const tabsNode =
        areaNode && isMosaicLayoutTabsNode(areaNode as MosaicLayoutTabsNode)
          ? (areaNode as MosaicLayoutTabsNode)
          : undefined;

      const showTabStrip = tabsNode?.showTabStrip !== false;
      const isCollapsed = tabsNode?.collapsed === true;
      const isCollapsible = tabsNode?.collapsible === true;
      const closeableTabs = tabsNode?.closeableTabs === true;
      const creatableTabs = tabsNode?.creatableTabs === true;
      const searchableTabs = tabsNode?.searchableTabs === true;
      const areaId = tabsNode?.id;

      if (isCollapsed) {
        return <div />;
      }

      if (!showTabStrip) {
        if (isCollapsible && areaId) {
          return (
            <div className="flex h-7 items-center justify-end px-1">
              <CollapseButton onClick={() => onAreaCollapse?.(areaId)} />
            </div>
          );
        }
        return <div />;
      }

      if (!showTabStrip && !(tabs.length > 1 || tabsNode?.id)) {
        return <div />;
      }

      // All panels for this area (for the searchable dropdown)
      const allAreaPanelIds = areaId
        ? Object.entries(panels ?? {})
            .filter(([, info]) => (info.area ?? info.placement) === areaId)
            .map(([id]) => id)
        : tabs;

      const allTabDescriptors: TabDescriptor[] = allAreaPanelIds.map((id) => ({
        id,
        name: panels?.[id]?.title ?? id,
      }));

      const selectedTabId = tabs[activeTabIndex];

      return (
        <TabStrip
          tabs={allTabDescriptors}
          openTabs={tabs}
          selectedTabId={selectedTabId}
          preventCloseLastTab
          closeable={closeableTabs}
          onSelect={(tabId) => onTabSelect?.(path, tabId)}
          onClose={
            closeableTabs ? (tabId) => onTabClose?.(path, tabId) : undefined
          }
          onOpenTabsChange={(tabIds) => onTabReorder?.(path, tabIds)}
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
      );
    },
    [
      currentValue,
      panels,
      onTabSelect,
      onTabClose,
      onTabReorder,
      onTabCreate,
      onAreaCollapse,
      renderTabLabel,
    ],
  );

  const renderTileWithCollapsedStrips = useCallback(
    (id: string, path: MosaicPath) => {
      const tree = currentValue as MosaicLayoutNode | undefined;

      if (id.startsWith(MOSAIC_NODE_KEY_PREFIX)) {
        const mosaicId = id.slice(MOSAIC_NODE_KEY_PREFIX.length);
        return (
          <NestedMosaicTile
            mosaicId={mosaicId}
            rootTree={tree ?? null}
            panels={panels}
            renderTile={renderTile}
            onChange={handleNestedMosaicChange}
          />
        );
      }

      const tileContent = renderTile(id, path);

      if (!tree) {
        return (
          <MosaicTile
            id={id}
            className={cn('bg-secondary/10', tileClassName)}
            path={path}
            isDragging={isDragging}
            content={tileContent}
            currentTree={currentValue as MosaicNode<string> | null}
            panelInfo={panels?.[id]}
            forceDraggable={forceDraggable}
          />
        );
      }

      // Find the tabs node this tile belongs to
      const parentArea = findParentArea(tree, path);
      const tabsPath = parentArea?.path ?? path;

      // Find collapsed siblings that want their tab strip rendered here
      const collapsedSiblings = findCollapsedSiblings(tree, tabsPath);

      if (collapsedSiblings.length === 0) {
        return (
          <MosaicTile
            id={id}
            className={cn('bg-secondary/10', tileClassName)}
            path={path}
            isDragging={isDragging}
            content={tileContent}
            currentTree={currentValue as MosaicNode<string> | null}
            panelInfo={panels?.[id]}
            forceDraggable={forceDraggable}
          />
        );
      }

      // Group by position
      const top = collapsedSiblings.filter((s) => s.expandDirection === 'down');
      const bottom = collapsedSiblings.filter(
        (s) => s.expandDirection === 'up',
      );
      const left = collapsedSiblings.filter(
        (s) => s.expandDirection === 'right',
      );
      const right = collapsedSiblings.filter(
        (s) => s.expandDirection === 'left',
      );

      const hasVertical = top.length > 0 || bottom.length > 0;
      const hasHorizontal = left.length > 0 || right.length > 0;

      const core = (
        <MosaicTile
          id={id}
          className={cn('bg-secondary/10 h-auto! flex-1!', tileClassName)}
          path={path}
          isDragging={isDragging}
          content={tileContent}
          currentTree={currentValue as MosaicNode<string> | null}
          panelInfo={panels?.[id]}
          forceDraggable={forceDraggable}
        />
      );

      const innerContent = hasHorizontal ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-row">
          {left.map((a) => (
            <CollapsedVerticalStrip
              key={a.node.id}
              area={a}
              onExpand={onAreaExpand}
            />
          ))}
          {core}
          {right.map((a) => (
            <CollapsedVerticalStrip
              key={a.node.id}
              area={a}
              onExpand={onAreaExpand}
            />
          ))}
        </div>
      ) : (
        core
      );

      if (!hasVertical && !hasHorizontal) {
        return core;
      }

      return (
        <div className="flex h-full w-full flex-col">
          {top.map((a) => (
            <CollapsedHorizontalStrip
              key={a.node.id}
              area={a}
              panels={panels}
              onExpand={onAreaExpand}
            />
          ))}
          {hasVertical ? (
            <div className="min-h-0 flex-1">{innerContent}</div>
          ) : (
            innerContent
          )}
          {bottom.map((a) => (
            <CollapsedHorizontalStrip
              key={a.node.id}
              area={a}
              panels={panels}
              onExpand={onAreaExpand}
            />
          ))}
        </div>
      );
    },
    [
      currentValue,
      renderTile,
      tileClassName,
      isDragging,
      panels,
      onAreaExpand,
      handleNestedMosaicChange,
      forceDraggable,
    ],
  );

  return (
    <div className="bg relative h-full w-full">
      <style>{customMosaicStyles}</style>
      <Mosaic<string>
        {...props}
        value={mosaicValue}
        className=""
        onChange={handleLayoutChange}
        onRelease={handleLayoutRelease}
        renderTabToolbar={renderTabToolbar}
        renderTile={renderTileWithCollapsedStrips}
      />
    </div>
  );
};

/**
 * Renders a nested MosaicLayout for a `type: 'mosaic'` node.
 * This creates a separate react-mosaic Mosaic instance, providing drag containment.
 */
function NestedMosaicTile({
  mosaicId,
  rootTree,
  panels,
  renderTile,
  onChange,
}: {
  mosaicId: string;
  rootTree: MosaicLayoutNode | null;
  panels?: Record<string, RoomPanelInfo>;
  renderTile: (id: string, path: MosaicPath) => React.JSX.Element;
  onChange: (mosaicId: string, newNodes: MosaicLayoutNode | null) => void;
}) {
  const mosaicNode = rootTree
    ? findMosaicNodeById(rootTree, mosaicId)
    : undefined;

  const handleChange = useCallback(
    (newNodes: MosaicNode<string> | null) => {
      onChange(mosaicId, newNodes as MosaicLayoutNode | null);
    },
    [mosaicId, onChange],
  );

  if (!mosaicNode) return null;

  const draggable = mosaicNode.draggable !== false;

  return (
    <MosaicLayout
      renderTile={renderTile}
      value={mosaicNode.nodes as MosaicNode<string> | null}
      onChange={handleChange}
      panels={panels}
      forceDraggable={draggable}
    />
  );
}

/**
 * Walk the tree looking for collapsed areas whose split percentage
 * has been manually resized past the threshold — auto-uncollapse them.
 */
function checkResizeUncollapse(
  root: MosaicLayoutNode,
  onAreaExpand?: (areaId: string) => void,
) {
  if (!onAreaExpand) return;
  (function walk(node: MosaicLayoutNode, path: MosaicPath) {
    if (!node || typeof node === 'string') return;
    if (isMosaicLayoutSplitNode(node)) {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (
          child &&
          typeof child !== 'string' &&
          isMosaicLayoutTabsNode(child) &&
          child.collapsed &&
          child.id &&
          node.splitPercentages
        ) {
          const pct = node.splitPercentages[i] ?? 0;
          if (pct > UNCOLLAPSE_THRESHOLD) {
            onAreaExpand(child.id);
          }
        }
        walk(node.children[i]!, [...path, i]);
      }
    }
  })(root, []);
}

function CollapsedHorizontalStrip({
  area,
  panels,
  onExpand,
}: {
  area: CollapsedAreaInfo;
  panels?: Record<string, RoomPanelInfo>;
  onExpand?: (areaId: string, panelId?: string) => void;
}) {
  const {node, expandDirection} = area;
  const areaId = node.id!;
  const ChevronIcon = CHEVRON_ICONS[expandDirection];

  const tabDescriptors: TabDescriptor[] = node.tabs.map((id) => ({
    id,
    name: panels?.[id]?.title ?? id,
  }));

  const renderLabel = useCallback(
    (tab: TabDescriptor) => {
      const Icon = panels?.[tab.id]?.icon;
      return (
        <span className="flex items-center gap-1.5 truncate">
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />}
          <span className="truncate">{tab.name}</span>
        </span>
      );
    },
    [panels],
  );

  return (
    <div className="border-border shrink-0 border-t">
      <TabStrip
        tabs={tabDescriptors}
        openTabs={node.tabs}
        selectedTabId={undefined}
        preventCloseLastTab
        closeable={false}
        onSelect={(tabId) => onExpand?.(areaId, tabId)}
        renderTabLabel={renderLabel}
      >
        <TabStrip.Tabs />
        <ExpandButton
          ChevronIcon={ChevronIcon}
          onClick={() => onExpand?.(areaId)}
        />
      </TabStrip>
    </div>
  );
}

function CollapsedVerticalStrip({
  area,
  onExpand,
}: {
  area: CollapsedAreaInfo;
  onExpand?: (areaId: string) => void;
}) {
  const {expandDirection} = area;
  const areaId = area.node.id!;
  const ChevronIcon = CHEVRON_ICONS[expandDirection];

  return (
    <div className="border-border flex shrink-0 items-start border-x pt-1">
      <Button
        variant="ghost"
        size="icon"
        className="hover:bg-primary/10 h-7 w-7 shrink-0"
        onClick={() => onExpand?.(areaId)}
        aria-label="Expand"
      >
        <ChevronIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

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
  ChevronIcon,
  onClick,
}: {
  ChevronIcon: React.ComponentType<{className?: string}>;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="hover:bg-primary/10 h-7 w-7 shrink-0"
      onClick={onClick}
      aria-label="Expand"
    >
      <ChevronIcon className="h-3.5 w-3.5" />
    </Button>
  );
}

export default MosaicLayout;
