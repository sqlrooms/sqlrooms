import {
  getLayoutNodeId,
  isLayoutGridNode,
  LayoutNode,
} from '@sqlrooms/layout-config';
import {useCallback, useMemo} from 'react';
import {
  createDefaultGridLayouts,
  DEFAULT_GRID_BREAKPOINTS,
  expandGridLayoutsItemHorizontally,
  getResponsiveGridCols,
  isGridLayoutsItemHorizontallyExpanded,
  shrinkGridLayoutsItemHorizontally,
} from '../../grid-layout-utils';
import {useLayoutNodeContext} from '../../LayoutNodeContext';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {findNodeById} from '../../layout-tree';

function cloneLayoutNode(node: LayoutNode): LayoutNode {
  return structuredClone(node) as LayoutNode;
}

export function useExpandGridPanel(): {
  canExpandGridPanel: boolean;
  isGridPanelHorizontallyExpanded: boolean;
  expandGridPanel: () => void;
} {
  const context = useLayoutNodeContext();
  const {rootLayout, onLayoutChange} = useLayoutRendererContext();
  const isGridChild =
    context.containerType === 'leaf' && context.parentContainerType === 'grid';
  const gridId = isGridChild ? context.parentContainerId : undefined;
  const panelId = isGridChild ? getLayoutNodeId(context.node) : undefined;
  const canExpandGridPanel = Boolean(gridId && panelId && onLayoutChange);
  const gridPanelState = useMemo(() => {
    if (!gridId || !panelId) {
      return {isGridPanelHorizontallyExpanded: false};
    }

    const result = findNodeById(rootLayout, gridId);
    if (!result || !isLayoutGridNode(result.node)) {
      return {isGridPanelHorizontallyExpanded: false};
    }

    const gridNode = result.node;
    const breakpoints = gridNode.breakpoints ?? DEFAULT_GRID_BREAKPOINTS;
    const cols = getResponsiveGridCols(gridNode.cols, breakpoints);
    const layouts =
      gridNode.layouts ?? createDefaultGridLayouts(gridNode.children, cols);

    return {
      isGridPanelHorizontallyExpanded: isGridLayoutsItemHorizontallyExpanded(
        layouts,
        panelId,
        cols,
      ),
    };
  }, [gridId, panelId, rootLayout]);

  const expandGridPanel = useCallback(() => {
    if (!gridId || !panelId || !onLayoutChange) {
      return;
    }

    const nextRootLayout = cloneLayoutNode(rootLayout);
    const result = findNodeById(nextRootLayout, gridId);
    if (!result || !isLayoutGridNode(result.node)) {
      return;
    }

    const gridNode = result.node;
    const breakpoints = gridNode.breakpoints ?? DEFAULT_GRID_BREAKPOINTS;
    const cols = getResponsiveGridCols(gridNode.cols, breakpoints);
    const layouts =
      gridNode.layouts ?? createDefaultGridLayouts(gridNode.children, cols);
    const isExpanded = isGridLayoutsItemHorizontallyExpanded(
      layouts,
      panelId,
      cols,
    );
    const resultLayouts = isExpanded
      ? shrinkGridLayoutsItemHorizontally(layouts, panelId, cols)
      : expandGridLayoutsItemHorizontally(layouts, panelId, cols);

    if (!resultLayouts.changed) {
      return;
    }

    gridNode.layouts = resultLayouts.layouts;
    onLayoutChange(nextRootLayout);
  }, [gridId, onLayoutChange, panelId, rootLayout]);

  return {canExpandGridPanel, expandGridPanel, ...gridPanelState};
}
