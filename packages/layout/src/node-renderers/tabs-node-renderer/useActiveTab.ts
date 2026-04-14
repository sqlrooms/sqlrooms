import {useTabsLayoutContext} from './TabsLayoutProvider';
import {
  getLayoutNodeId,
  getVisibleTabChildren,
  LayoutNode,
  LayoutTabsNode,
} from '@sqlrooms/layout-config';
import {LayoutPath} from '../../types';
import {useMemo} from 'react';

export type ActiveTabInfo = {
  container: LayoutTabsNode;
  node: LayoutNode | null;
  path: LayoutPath | null;
  id: string | null;
};

export function useActiveTab(): ActiveTabInfo {
  const {node, path} = useTabsLayoutContext();

  const visibleChildren = useMemo(() => getVisibleTabChildren(node), [node]);

  const activeChild = visibleChildren[node.activeTabIndex] ?? null;
  const activeChildId = activeChild ? getLayoutNodeId(activeChild) : null;
  const activeChildPath = activeChildId ? [...path, activeChildId] : null;

  return {
    container: node,
    node: activeChild,
    path: activeChildPath,
    id: activeChildId,
  };
}
