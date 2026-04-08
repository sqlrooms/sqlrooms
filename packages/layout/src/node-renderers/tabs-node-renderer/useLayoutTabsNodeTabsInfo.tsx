import {LayoutTabsNode} from '@sqlrooms/layout-config';
import {TabDescriptor} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {getChildKey} from '../../mosaic/mosaic-utils';
import {extractPanelId} from '../utils';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {LayoutPath} from '../../types';
import {matchNodePathToPanel} from '../../matchNodePathToPanel';

type UseLayoutTabsNodeTabsInfoResult = {
  activeTabId: string | undefined;
  visibleTabIds: string[];
  allTabIds: string[];
  tabDescriptors: TabDescriptor[];
};

export function useLayoutTabsNodeTabsInfo(
  node: LayoutTabsNode,
  path: LayoutPath,
): UseLayoutTabsNodeTabsInfoResult {
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

  const activeTabId = visibleTabIds[node.activeTabIndex];

  const tabDescriptors: TabDescriptor[] = useMemo(
    () =>
      allTabIds.map((id) => {
        const panelId = extractPanelId(id);
        const currentPath = [...path, panelId];
        const panelInfo = matchNodePathToPanel(currentPath, panels);

        return {id, name: panelInfo?.panel.title ?? panelId};
      }),
    [allTabIds, panels, path],
  );

  return {activeTabId, visibleTabIds, allTabIds, tabDescriptors};
}
