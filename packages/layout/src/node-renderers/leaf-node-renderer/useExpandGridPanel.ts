import {
  getLayoutNodeId,
  isLayoutGridNode,
  LayoutNode,
} from '@sqlrooms/layout-config';
import {useCallback} from 'react';
import {
  createDefaultGridLayouts,
  DEFAULT_GRID_BREAKPOINTS,
  expandGridLayoutsItemHorizontally,
  getResponsiveGridCols,
} from '../../grid-layout-utils';
import {useLayoutNodeContext} from '../../LayoutNodeContext';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {findNodeById} from '../../layout-tree';

export function useExpandGridPanel(): {
  canExpandGridPanel: boolean;
  expandGridPanel: () => void;
} {
  const context = useLayoutNodeContext();
  const {rootLayout, onLayoutChange} = useLayoutRendererContext();
  const isGridChild =
    context.containerType === 'leaf' && context.parentContainerType === 'grid';
  const gridId = isGridChild ? context.parentContainerId : undefined;
  const panelId = isGridChild ? getLayoutNodeId(context.node) : undefined;
  const canExpandGridPanel = Boolean(gridId && panelId && onLayoutChange);

  const expandGridPanel = useCallback(() => {
    if (!gridId || !panelId || !onLayoutChange) {
      return;
    }

    const nextRootLayout = JSON.parse(JSON.stringify(rootLayout)) as LayoutNode;
    const result = findNodeById(nextRootLayout, gridId);
    if (!result || !isLayoutGridNode(result.node)) {
      return;
    }

    const gridNode = result.node;
    const breakpoints = gridNode.breakpoints ?? DEFAULT_GRID_BREAKPOINTS;
    const cols = getResponsiveGridCols(gridNode.cols, breakpoints);
    const layouts =
      gridNode.layouts ?? createDefaultGridLayouts(gridNode.children, cols);
    const expanded = expandGridLayoutsItemHorizontally(layouts, panelId, cols);

    if (!expanded.changed) {
      return;
    }

    gridNode.layouts = expanded.layouts;
    onLayoutChange(nextRootLayout);
  }, [gridId, onLayoutChange, panelId, rootLayout]);

  return {canExpandGridPanel, expandGridPanel};
}
