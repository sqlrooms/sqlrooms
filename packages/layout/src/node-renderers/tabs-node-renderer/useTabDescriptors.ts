import {TabDescriptor} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {getLayoutNodeId} from '@sqlrooms/layout-config';
import {useStoreWithLayout} from '../../LayoutSlice';
import {useTabsNodeContext} from '../../LayoutNodeContext';
import {resolvePanelIdentity} from '../../resolvePanelIdentity';
import {resolvePanelDefinition} from '../../resolvePanelDefinition';

export function useTabDescriptors(): TabDescriptor[] {
  const tabsContext = useTabsNodeContext();
  const {node} = tabsContext;

  const panels = useStoreWithLayout((s) => s.layout.panels);

  const tabDescriptors: TabDescriptor[] = useMemo(() => {
    return node.children.map((child) => {
      const id = getLayoutNodeId(child);
      const {panelId, meta} = resolvePanelIdentity(child);
      const definition = panels[panelId];
      const panelInfo = definition
        ? resolvePanelDefinition(definition, {
            panelId,
            meta,
            layoutNode: tabsContext,
          })
        : null;

      return {
        id,
        name: panelInfo?.title ?? panelId,
        icon: panelInfo?.icon,
      };
    });
  }, [node.children, panels, tabsContext]);

  return tabDescriptors;
}
