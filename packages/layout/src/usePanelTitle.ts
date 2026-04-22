import {useMemo} from 'react';
import {LayoutNode} from '@sqlrooms/layout-config';
import {useGetPanel} from './useGetPanel';
import {findNodeById} from './layout-tree';

/**
 * React hook that resolves panel title using full panel definition system.
 * Resolves function-form panel definitions and accesses the actual panel title.
 *
 * @param root - Layout tree root
 * @param panelId - Panel ID to resolve
 * @returns Panel title or panelId as fallback
 */
export function usePanelTitle(root: LayoutNode, panelId: string): string {
  const found = useMemo(() => findNodeById(root, panelId), [root, panelId]);

  const panel = useGetPanel(found?.node ?? panelId);

  return panel?.title ?? panelId;
}
