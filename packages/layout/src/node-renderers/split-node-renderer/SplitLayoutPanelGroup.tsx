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
import {computeDefaultLayout} from './computeDefaultLayout';

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
