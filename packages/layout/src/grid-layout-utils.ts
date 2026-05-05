import {
  isLayoutNodeKey,
  LayoutGridItem,
  LayoutGridNode,
  LayoutNode,
} from '@sqlrooms/layout-config';

export const DEFAULT_GRID_BREAKPOINTS = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
};
export const DEFAULT_GRID_COLS = {lg: 12, md: 10, sm: 6, xs: 4, xxs: 2};

export type GridLayouts = NonNullable<LayoutGridNode['layouts']>;

export function getGridChildId(node: LayoutNode): string {
  return isLayoutNodeKey(node) ? node : node.id;
}

export function getResponsiveGridCols(
  cols: LayoutGridNode['cols'],
  breakpoints: Record<string, number>,
): Record<string, number> {
  if (typeof cols === 'number') {
    return Object.fromEntries(
      Object.keys(breakpoints).map((breakpoint) => [breakpoint, cols]),
    );
  }

  const fallbackCols = cols?.lg ?? DEFAULT_GRID_COLS.lg;

  return Object.fromEntries(
    Object.keys(breakpoints).map((breakpoint) => [
      breakpoint,
      cols?.[breakpoint] ??
        DEFAULT_GRID_COLS[breakpoint as keyof typeof DEFAULT_GRID_COLS] ??
        fallbackCols,
    ]),
  );
}

function createDefaultGridItem(
  node: LayoutNode,
  index: number,
  cols: number,
): LayoutGridItem {
  const id = getGridChildId(node);
  const effectiveCols = Math.max(1, cols);
  const w = Math.min(3, effectiveCols);
  const h = 2;
  return {
    i: id,
    x: (index * w) % effectiveCols,
    y: Math.floor((index * w) / effectiveCols) * h,
    w,
    h,
  };
}

export function createDefaultGridLayouts(
  children: LayoutNode[],
  cols: Record<string, number>,
): GridLayouts {
  return Object.fromEntries(
    Object.entries(cols).map(([breakpoint, breakpointCols]) => [
      breakpoint,
      children.map((child, index) =>
        createDefaultGridItem(child, index, breakpointCols),
      ),
    ]),
  );
}

function verticallyOverlaps(
  item: LayoutGridItem,
  other: LayoutGridItem,
): boolean {
  return item.y < other.y + other.h && item.y + item.h > other.y;
}

export function expandGridLayoutItemHorizontally(
  layout: LayoutGridItem[],
  itemId: string,
  cols: number,
): {layout: LayoutGridItem[]; changed: boolean} {
  const item = layout.find((layoutItem) => layoutItem.i === itemId);
  if (!item) {
    return {layout, changed: false};
  }

  const effectiveCols = Math.max(1, cols);
  let leftBoundary = 0;
  let rightBoundary = effectiveCols;

  for (const other of layout) {
    if (other.i === item.i || !verticallyOverlaps(item, other)) {
      continue;
    }

    const otherRight = other.x + other.w;
    const itemRight = item.x + item.w;

    if (otherRight <= item.x) {
      leftBoundary = Math.max(leftBoundary, otherRight);
    } else if (other.x >= itemRight) {
      rightBoundary = Math.min(rightBoundary, other.x);
    }
  }

  const nextX = Math.min(leftBoundary, effectiveCols - 1);
  const nextW = Math.max(1, rightBoundary - nextX);

  if (item.x === nextX && item.w === nextW) {
    return {layout, changed: false};
  }

  return {
    layout: layout.map((layoutItem) =>
      layoutItem.i === item.i
        ? {
            ...layoutItem,
            x: nextX,
            w: nextW,
          }
        : layoutItem,
    ),
    changed: true,
  };
}

export function expandGridLayoutsItemHorizontally(
  layouts: GridLayouts,
  itemId: string,
  cols: Record<string, number>,
): {layouts: GridLayouts; changed: boolean} {
  let changed = false;
  const nextLayouts = Object.fromEntries(
    Object.entries(layouts).map(([breakpoint, layout]) => {
      const result = expandGridLayoutItemHorizontally(
        layout,
        itemId,
        cols[breakpoint] ?? DEFAULT_GRID_COLS.lg,
      );
      changed = changed || result.changed;
      return [breakpoint, result.layout];
    }),
  );

  return {layouts: nextLayouts, changed};
}
