import {TabDescriptor} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {extractPanelId} from '../utils';
import {getPanelByPath} from '../../getPanelByPath';
import {useStoreWithLayout} from '../../LayoutSlice';
import {useTabsNodeContext} from '../../LayoutNodeContext';
import {resolvePanelDefinition} from '../../resolvePanelDefinition';

export function useTabDescriptors(): TabDescriptor[] {
  const tabsContext = useTabsNodeContext();
  const {
    node: {id: nodeId},
    path,
  } = tabsContext;

  const panels = useStoreWithLayout((s) => s.layout.panels);
  const getTabs = useStoreWithLayout((s) => s.layout.getTabs);

  const tabDescriptors: TabDescriptor[] = useMemo(() => {
    return getTabs(nodeId).map((id) => {
      const panelId = extractPanelId(id);
      const matchResult = getPanelByPath(panels, [...path, panelId]);
      if (!matchResult) {
        return {id, name: panelId};
      }
      const resolved = resolvePanelDefinition(matchResult.panel, {
        panelId: matchResult.panelId,
        params: matchResult.params,
        layoutNode: tabsContext,
      });
      return {id, name: resolved?.title ?? panelId};
    });
  }, [getTabs, panels, path, nodeId, tabsContext]);

  return tabDescriptors;
}
