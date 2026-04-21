import {
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  isLayoutDockNode,
} from '@sqlrooms/layout-config';
import {lazy, ReactElement, Suspense} from 'react';
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

const LeafLayout = lazy(() =>
  import('./leaf-node-renderer/LeafLayout').then((m) => ({
    default: m.LeafLayout.Root,
  })),
);

const DockNodeRenderer = lazy(() =>
  import('./dock-node-renderer/DockLayout').then((m) => ({
    default: m.DockLayout.Root,
  })),
);

/**
 * Recursively renders a layout node.
 * This function is used via RenderNodeContext to break circular dependencies.
 */
export const renderLayoutNode = (props: NodeRenderProps): ReactElement => {
  const {node, path, parentDirection} = props;
  return (
    <Suspense fallback={null}>
      {(isLayoutNodeKey(node) || isLayoutPanelNode(node)) && (
        <LeafLayout node={node} path={path} />
      )}
      {isLayoutSplitNode(node) && <SplitLayout node={node} path={path} />}
      {isLayoutTabsNode(node) && (
        <TabsLayout node={node} path={path} parentDirection={parentDirection} />
      )}
      {isLayoutDockNode(node) && (
        <DockNodeRenderer
          node={node}
          path={path}
          parentDirection={parentDirection}
        />
      )}
    </Suspense>
  );
};
