import {
  LayoutMosaicNode,
  LayoutNode,
  LayoutNodeKey,
  LayoutPanelNode,
  LayoutSplitNode,
  LayoutTabsNode,
} from '@sqlrooms/layout-config';
import {createContext, FC, PropsWithChildren, useContext} from 'react';
import type {LayoutPath} from './types';
import {ParentDirection} from './node-renderers/types';

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

export type LayoutNodeContextMosaic = {
  containerType: 'mosaic';
  node: LayoutMosaicNode;
  path: LayoutPath;
};

export type LayoutNodeContextPanel = {
  containerType: 'panel';
  node: LayoutPanelNode;
  path: LayoutPath;
};

export type LayoutNodeContextLeaf = {
  containerType: 'leaf';
  node: LayoutNodeKey;
  path: LayoutPath;
};

export type LayoutNodeContextValue =
  | LayoutNodeContextTabs
  | LayoutNodeContextSplit
  | LayoutNodeContextMosaic
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

export function getLayoutNodeContextValue(
  node: LayoutNode,
  path: LayoutPath,
  parentDirection?: ParentDirection,
): LayoutNodeContextValue {
  if (typeof node === 'string') {
    return {containerType: 'leaf', node, path};
  }
  switch (node.type) {
    case 'tabs':
      return {containerType: 'tabs', node, path, parentDirection};
    case 'split':
      return {containerType: 'split', node, path, parentDirection};
    case 'mosaic':
      return {containerType: 'mosaic', node, path};
    case 'panel':
      return {containerType: 'panel', node, path};
  }
}
