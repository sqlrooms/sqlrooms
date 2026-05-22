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
  groupSize: number,
  previousDefaultSize: string | number | undefined,
) {
  const asPercentage = Number(layoutSize.toFixed(4));
  const inPixels =
    groupSize > 0 ? Math.round((layoutSize / 100) * groupSize) : 0;

  if (typeof previousDefaultSize === 'number') {
    return inPixels;
  }

  if (typeof previousDefaultSize === 'string') {
    const trimmedSize = previousDefaultSize.trim();
    if (trimmedSize.endsWith('%')) {
      return `${asPercentage}%`;
    }
    if (trimmedSize.endsWith('px')) {
      return `${inPixels}px`;
    }
  }

  return `${asPercentage}%`;
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

      const groupElement = groupElementRef.current;
      const groupSize = groupElement
        ? parentNode.direction === 'column'
          ? groupElement.offsetHeight
          : groupElement.offsetWidth
        : 0;

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
        const defaultSize = formatResizedDefaultSize(
          layoutSize,
          groupSize,
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
