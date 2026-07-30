import {FC, PropsWithChildren, useCallback, useMemo, useRef} from 'react';
import {
  getLayoutNodeId,
  isLayoutNodeKey,
  LayoutNode,
} from '@sqlrooms/layout-config';
import {ResizablePanelGroup} from '@sqlrooms/ui';
import {useSplitNodeContext} from '../../LayoutNodeContext';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {updateLayoutNodeById} from '../../layout-tree';
import type {Layout, LayoutChangedMeta} from 'react-resizable-panels';
import {isCollapsed} from '../utils';

export type RenderPanelProps = {
  node: LayoutNode;
  nodeIndex: number;
};

function formatResizedDefaultSize(
  layoutSize: number,
  panelSizeInPixels: number | undefined,
  previousDefaultSize: string | number | undefined,
) {
  const asPercentage = Number(layoutSize.toFixed(4));
  const inPixels =
    panelSizeInPixels === undefined ? undefined : Math.round(panelSizeInPixels);

  if (typeof previousDefaultSize === 'number') {
    return inPixels ?? previousDefaultSize;
  }

  if (typeof previousDefaultSize === 'string') {
    const trimmedSize = previousDefaultSize.trim();
    if (trimmedSize.endsWith('%')) {
      return `${asPercentage}%`;
    }
    if (trimmedSize.endsWith('px')) {
      return inPixels === undefined ? previousDefaultSize : `${inPixels}px`;
    }
  }

  return `${asPercentage}%`;
}

function getPanelSizeInPixels(
  groupElement: HTMLDivElement | null,
  panelId: string,
  direction: 'row' | 'column',
) {
  const panelElement = Array.from(
    groupElement?.querySelectorAll<HTMLElement>('[data-panel]') ?? [],
  ).find((element) => element.id === panelId);

  return direction === 'column'
    ? panelElement?.offsetHeight
    : panelElement?.offsetWidth;
}

/**
 * Parse a node `defaultSize` into a percentage number, or `undefined` when it
 * is not expressed as a percentage (e.g. pixels or unset). Pixel/unset sizes
 * cannot be converted without measuring the container, so they are treated as
 * "unknown" and distributed evenly by {@link computeDefaultLayout}.
 */
function parsePercentSize(
  size: string | number | undefined,
): number | undefined {
  if (typeof size === 'number') {
    return undefined; // numeric == pixels in this codebase
  }
  if (typeof size === 'string' && size.trim().endsWith('%')) {
    const value = Number.parseFloat(size);
    return Number.isFinite(value) ? value : undefined;
  }
  return undefined;
}

/**
 * Derive the group's initial RRP `Layout` ({panelId → percentage}) from the
 * declared node sizes and collapsed flags. Collapsed nodes get 0; the rest fill
 * the remaining space proportionally to their `defaultSize` (unknown/pixel
 * sizes share evenly). This makes RRP paint the correct (already-collapsed)
 * layout on the very first frame instead of flashing the uncollapsed sizes and
 * then imperatively collapsing after mount.
 */
function computeDefaultLayout(children: LayoutNode[]): Layout | undefined {
  if (children.length === 0) {
    return undefined;
  }

  const entries = children.map((child) => {
    const id = getLayoutNodeId(child);
    const collapsed = isCollapsed(child);
    const percent = isLayoutNodeKey(child)
      ? undefined
      : parsePercentSize(child.defaultSize);
    return {id, collapsed, percent};
  });

  const visible = entries.filter((entry) => !entry.collapsed);
  if (visible.length === 0) {
    // Degenerate: everything collapsed. Let RRP fall back to per-panel sizing.
    return undefined;
  }

  const knownSum = visible.reduce(
    (sum, entry) => sum + (entry.percent ?? 0),
    0,
  );
  const unknownCount = visible.filter(
    (entry) => entry.percent === undefined,
  ).length;
  const remaining = Math.max(0, 100 - knownSum);
  const perUnknown = unknownCount > 0 ? remaining / unknownCount : 0;

  const rawWeights = new Map<string, number>();
  for (const entry of entries) {
    if (entry.collapsed) {
      rawWeights.set(entry.id, 0);
    } else {
      rawWeights.set(entry.id, entry.percent ?? perUnknown);
    }
  }

  const visibleTotal = visible.reduce(
    (sum, entry) => sum + (rawWeights.get(entry.id) ?? 0),
    0,
  );

  const layout: Layout = {};
  for (const entry of entries) {
    if (entry.collapsed) {
      layout[entry.id] = 0;
    } else if (visibleTotal > 0) {
      layout[entry.id] = ((rawWeights.get(entry.id) ?? 0) / visibleTotal) * 100;
    } else {
      layout[entry.id] = 100 / visible.length;
    }
  }
  return layout;
}

function updateNodeDefaultSize(
  node: LayoutNode,
  defaultSize: string | number,
): LayoutNode {
  if (isLayoutNodeKey(node)) {
    return {
      type: 'panel',
      id: node,
      panel: node,
      defaultSize,
    };
  }

  if (node.defaultSize === defaultSize) {
    return node;
  }

  return {...node, defaultSize};
}

export const SplitLayoutPanelGroup: FC<PropsWithChildren> = ({children}) => {
  const {node: parentNode} = useSplitNodeContext();
  const {rootLayout, onLayoutChange} = useLayoutRendererContext();
  const groupElementRef = useRef<HTMLDivElement | null>(null);

  const orientation =
    parentNode.direction === 'column' ? 'vertical' : 'horizontal';

  const defaultLayout = useMemo(
    () => computeDefaultLayout(parentNode.children),
    [parentNode.children],
  );

  const handleLayoutChanged = useCallback(
    (layout: Layout, meta: LayoutChangedMeta) => {
      console.log('Layout changed:', layout, meta);
      // Only persist genuine user-driven resizes. Programmatic collapse/expand,
      // initial mount, constraint recompute and default-size changes all report
      // `isUserInteraction === false` — writing those back into the config would
      // create a render feedback loop and drift the stored `defaultSize`s.
      if (!meta.isUserInteraction) {
        return;
      }

      if (!onLayoutChange) {
        return;
      }

      let nextRootLayout = rootLayout;

      for (const child of parentNode.children) {
        const panelId = getLayoutNodeId(child);
        const layoutSize = layout[panelId];

        if (layoutSize === undefined) {
          continue;
        }

        const previousDefaultSize = isLayoutNodeKey(child)
          ? undefined
          : child.defaultSize;
        const panelSizeInPixels = getPanelSizeInPixels(
          groupElementRef.current,
          panelId,
          parentNode.direction,
        );
        const defaultSize = formatResizedDefaultSize(
          layoutSize,
          panelSizeInPixels,
          previousDefaultSize,
        );

        nextRootLayout = updateLayoutNodeById(
          nextRootLayout,
          panelId,
          (currentNode) => updateNodeDefaultSize(currentNode, defaultSize),
        );
      }

      if (nextRootLayout !== rootLayout) {
        onLayoutChange(nextRootLayout);
      }
    },
    [onLayoutChange, parentNode.children, parentNode.direction, rootLayout],
  );

  return (
    <ResizablePanelGroup
      elementRef={groupElementRef}
      orientation={orientation}
      defaultLayout={defaultLayout}
      onLayoutChanged={handleLayoutChanged}
    >
      {children}
    </ResizablePanelGroup>
  );
};
