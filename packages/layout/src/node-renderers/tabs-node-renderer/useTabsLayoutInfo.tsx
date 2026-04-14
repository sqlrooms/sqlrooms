import {LayoutNode, LayoutTabsNode} from '@sqlrooms/layout-config';
import {TabDescriptor} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {getChildKey} from '../../mosaic/mosaic-utils';
import {extractPanelId} from '../utils';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {LayoutPath} from '../../types';
import {matchNodePathToPanel} from '../../matchNodePathToPanel';

export type TabsLayoutInfo = {
  activeTabId: string | null;
  activeChild: LayoutNode | null;
  activeChildPath: LayoutPath | null;
  visibleTabIds: string[];
  allTabIds: string[];
  tabDescriptors: TabDescriptor[];
};

export function useTabsLayoutInfo(
  node: LayoutTabsNode,
  path: LayoutPath,
): TabsLayoutInfo {
  const {panels} = useLayoutRendererContext();

  const visibleTabIds = useMemo(
    () =>
      node.children
        .map((child) => getChildKey(child))
        .filter((id): id is string => id != null),
    [node.children],
  );

  const allTabIds = useMemo(() => {
    const ids = [...visibleTabIds];

    if (node.closedChildren) {
      for (const id of node.closedChildren) {
        if (!ids.includes(id)) {
          ids.push(id);
        }
      }
    }
    return ids;
  }, [visibleTabIds, node.closedChildren]);

  const activeTabId = visibleTabIds[node.activeTabIndex] ?? null;
  const activeChild = node.children[node.activeTabIndex] ?? null;
  const activeChildPath = activeTabId ? [...path, activeTabId] : null;

  const tabDescriptors: TabDescriptor[] = useMemo(
    () =>
      allTabIds.map((id) => {
        const panelId = extractPanelId(id);
        const panelInfo = matchNodePathToPanel(panels, [...path, panelId]);

        return {id, name: panelInfo?.panel.title ?? panelId};
      }),
    [allTabIds, panels, path],
  );

  return {
    activeTabId,
    activeChild,
    activeChildPath,
    visibleTabIds,
    allTabIds,
    tabDescriptors,
  };
}
