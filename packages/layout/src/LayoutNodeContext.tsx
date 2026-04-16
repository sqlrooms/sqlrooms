import {
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutNode,
  LayoutNodeKey,
  LayoutPanelNode,
  LayoutSplitNode,
  LayoutTabsNode,
} from '@sqlrooms/layout-config';
import {createContext, FC, PropsWithChildren, useContext} from 'react';
import type {LayoutPath, ParentDirection} from './layout-base-types';

export type LayoutNodeContextTabs = {
  containerType: 'tabs';
  node: LayoutTabsNode;
  path: LayoutPath;
  parentDirection?: ParentDirection;
};

export type LayoutNodeContextSplit = {
  containerType: 'split';
  node: LayoutSplitNode;
  path: LayoutPath;
  parentDirection?: ParentDirection;
};

export type LayoutNodeContextPanel = {
  containerType: 'panel';
  node: LayoutPanelNode;
  path: LayoutPath;
};

export type LayoutNodeContextLeaf = {
  containerType: 'leaf';
  node: LayoutPanelNode | LayoutNodeKey;
  path: LayoutPath;
};

export type LayoutNodeContextValue =
  | LayoutNodeContextTabs
  | LayoutNodeContextSplit
  | LayoutNodeContextPanel
  | LayoutNodeContextLeaf;

export const LayoutNodeContext = createContext<LayoutNodeContextValue | null>(
  null,
);

export const LayoutNodeProvider: FC<
  PropsWithChildren<LayoutNodeContextValue>
> = ({children, ...value}) => {
  return (
    <LayoutNodeContext.Provider value={value}>
      {children}
    </LayoutNodeContext.Provider>
  );
};

export function useLayoutNodeContext(): LayoutNodeContextValue {
  const context = useContext(LayoutNodeContext);
  if (!context) {
    throw new Error(
      'useLayoutNodeContext must be used within LayoutNodeProvider',
    );
  }
  return context;
}

export function useTabsNodeContext(): LayoutNodeContextTabs {
  const context = useLayoutNodeContext();
  if (context.containerType !== 'tabs') {
    throw new Error(
      `useTabsNodeContext expected containerType "tabs", got "${context.containerType}"`,
    );
  }
  return context;
}

export function useSplitNodeContext(): LayoutNodeContextSplit {
  const context = useLayoutNodeContext();
  if (context.containerType !== 'split') {
    throw new Error(
      `useSplitNodeContext expected containerType "split", got "${context.containerType}"`,
    );
  }
  return context;
}

export function getLayoutNodeContextValue(
  node: LayoutNode,
  path: LayoutPath,
  parentDirection?: ParentDirection,
): LayoutNodeContextValue {
  if (isLayoutNodeKey(node) || isLayoutPanelNode(node)) {
    return {containerType: 'leaf', node, path};
  }

  if (isLayoutSplitNode(node)) {
    return {containerType: 'split', node, path, parentDirection};
  }

  if (isLayoutTabsNode(node)) {
    return {containerType: 'tabs', node, path, parentDirection};
  }

  throw new Error(`Unsupported node type: ${JSON.stringify(node)}`);
}
