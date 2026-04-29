import {useContext, useMemo} from 'react';
import {LayoutNode} from '@sqlrooms/layout-config';
import {RoomPanelInfo} from './types';
import {useStoreWithLayout} from './LayoutSlice';
import {resolvePanelDefinition} from './resolvePanelDefinition';
import {resolvePanelIdentity} from './resolvePanelIdentity';
import {
  LayoutNodeContext,
  type LayoutNodeContextValue,
} from './LayoutNodeContext';

function useOptionalLayoutNodeContext(): LayoutNodeContextValue | null {
  return useContext(LayoutNodeContext);
}

/**
 * React hook to get panel info from a layout node using direct panel identity.
 *
 * Reads the `panel` property from panel/dock nodes or falls back to the node's `id`,
 * looks it up in the panels registry, and resolves function-form definitions.
 *
 * @param node - The layout node to resolve panel info for
 * @returns Panel info object, or null if no match in registry
 */
export function useGetPanel(node: LayoutNode): RoomPanelInfo | null {
  const panels = useStoreWithLayout((s) => s.layout.panels);
  const layoutNode = useOptionalLayoutNodeContext();

  return useMemo(() => {
    const {panelId, meta} = resolvePanelIdentity(node);

    if (!panelId) {
      return null;
    }

    const definition = panels[panelId];

    if (!definition) {
      return null;
    }

    return resolvePanelDefinition(definition, {
      panelId,
      meta,
      layoutNode: layoutNode ?? undefined,
    });
  }, [node, panels, layoutNode]);
}
