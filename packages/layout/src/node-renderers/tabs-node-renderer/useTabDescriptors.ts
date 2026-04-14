import {TabDescriptor} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {extractPanelId} from '../utils';
import {getPanelByPath} from '../../getPanelByPath';
import {useStoreWithLayout} from '../../LayoutSlice';
import {useTabsLayoutContext} from './TabsLayoutProvider';

export function useTabDescriptors(): TabDescriptor[] {
  const {
    node: {id: nodeId},
    path,
  } = useTabsLayoutContext();

  const panels = useStoreWithLayout((s) => s.layout.panels);
  const getTabs = useStoreWithLayout((s) => s.layout.getTabs);

  const tabDescriptors: TabDescriptor[] = useMemo(() => {
    return getTabs(nodeId).map((id) => {
      const panelId = extractPanelId(id);
      const panelInfo = getPanelByPath(panels, [...path, panelId]);

      return {id, name: panelInfo?.panel.title ?? panelId};
    });
  }, [getTabs, panels, path, nodeId]);

  return tabDescriptors;
}
