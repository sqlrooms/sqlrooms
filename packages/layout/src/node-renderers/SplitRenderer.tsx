import {LayoutSplitNode} from '@sqlrooms/layout-config';
import React, {FC, useCallback, useEffect, useRef} from 'react';
import {
  Group,
  Panel,
  Separator,
  type PanelImperativeHandle,
  type PanelSize,
} from 'react-resizable-panels';
import {NodeRenderer} from './NodeRenderer';
import {
  getChildAreaId,
  getPanelId,
  getSizeProps,
  isChildCollapsed,
  isChildCollapsible,
  NodeRenderProps,
} from './types';

/**
 * Default minSize for collapsible panels that don't specify one.
 * Ensures react-resizable-panels snaps between collapsed and expanded
 * states instead of allowing intermediate sizes.
 */
const DEFAULT_COLLAPSIBLE_MIN_SIZE = '10%';

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

export const SplitRenderer: FC<
  Omit<NodeRenderProps, 'node'> & {node: LayoutSplitNode}
> = ({
  node,
  path,
  panels,
  rootLayout,
  resolvePanel,
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
            resolvePanel={resolvePanel}
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
