import {
  isLayoutMosaicNode,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
} from '@sqlrooms/layout-config';
import {FC, lazy, Suspense} from 'react';
import type {NodeRenderProps} from './types';

// Lazy load layout components to break circular dependencies
const SplitLayout = lazy(() =>
  import('./split-node-renderer/SplitLayout').then((m) => ({
    default: m.SplitLayout.Root,
  })),
);

const TabsLayout = lazy(() =>
  import('./tabs-node-renderer/TabsLayout').then((m) => ({
    default: m.TabsLayout.Root,
  })),
);

const MosaicLayout = lazy(() =>
  import('./mosaic-node-renderer/MosaicLayout').then((m) => ({
    default: m.MosaicLayout.Root,
  })),
);

const LeafLayout = lazy(() =>
  import('./leaf-node-renderer/LeafLayout').then((m) => ({
    default: m.LeafLayout.Root,
  })),
);

/**
 * Recursively renders a layout node.
 * This component is separate from NodeRenderer to avoid circular dependencies.
 */
export const LayoutNodeRenderer: FC<NodeRenderProps> = ({
  node,
  path,
  parentDirection,
}) => {
  return (
    <Suspense fallback={null}>
      {(isLayoutNodeKey(node) || isLayoutPanelNode(node)) && (
        <LeafLayout node={node} path={path} />
      )}
      {isLayoutSplitNode(node) && <SplitLayout node={node} path={path} />}
      {isLayoutTabsNode(node) && (
        <TabsLayout node={node} path={path} parentDirection={parentDirection} />
      )}
      {isLayoutMosaicNode(node) && <MosaicLayout node={node} path={path} />}
    </Suspense>
  );
};
