import {FC, PropsWithChildren, useCallback, useRef} from 'react';
import {
  getLayoutNodeId,
  isLayoutNodeKey,
  LayoutNode,
} from '@sqlrooms/layout-config';
import {ResizablePanelGroup} from '@sqlrooms/ui';
import {useSplitNodeContext} from '../../LayoutNodeContext';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {updateLayoutNodeById} from '../../layout-tree';
import type {Layout} from 'react-resizable-panels';

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
  const didReceiveInitialLayoutRef = useRef(false);

  const orientation =
    parentNode.direction === 'column' ? 'vertical' : 'horizontal';

  const handleLayoutChanged = useCallback(
    (layout: Layout) => {
      if (!didReceiveInitialLayoutRef.current) {
        didReceiveInitialLayoutRef.current = true;
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
      onLayoutChanged={handleLayoutChanged}
    >
      {children}
    </ResizablePanelGroup>
  );
};
