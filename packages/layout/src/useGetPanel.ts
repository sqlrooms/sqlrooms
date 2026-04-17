import {useContext, useMemo} from 'react';
import {getPanelByPath} from './getPanelByPath';
import {LayoutPath, RoomPanelInfo, MatchResult} from './types';
import {useStoreWithLayout} from './LayoutSlice';
import {resolvePanelDefinition} from './resolvePanelDefinition';
import {
  LayoutNodeContext,
  type LayoutNodeContextValue,
} from './LayoutNodeContext';

function useOptionalLayoutNodeContext(): LayoutNodeContextValue | null {
  return useContext(LayoutNodeContext);
}

/**
 * React hook to get full panel match information from the layout store by path.
 *
 * Matches the provided path against registered panel patterns and returns
 * the complete match result including the panel info, extracted parameters,
 * and resolved panel ID. Function-form panel definitions are automatically
 * resolved with the match context including the current layout node context.
 *
 * @param path - One or more path segments (variadic) to match against panel patterns.
 *               Can be individual segments or arrays of segments.
 * @returns Match result with panelId, panel info, and params, or null if no match
 */
export function useGetPanelInfoByPath(
  ...path: LayoutPath | LayoutPath[]
): MatchResult<RoomPanelInfo> | null {
  const panels = useStoreWithLayout((s) => s.layout.panels);
  const layoutNode = useOptionalLayoutNodeContext();

  return useMemo(() => {
    const match = getPanelByPath(panels, path);
    if (!match) return null;
    const resolved = resolvePanelDefinition(match.panel, {
      panelId: match.panelId,
      params: match.params,
      layoutNode: layoutNode ?? undefined,
    });
    return {panelId: match.panelId, panel: resolved, params: match.params};
  }, [path, panels, layoutNode]);
}

/**
 * React hook to get panel info from the layout store by path.
 *
 * Convenience hook that returns just the panel info without the match metadata.
 * If you need the panelId or extracted parameters, use `useGetPanelInfoByPath` instead.
 *
 * @param path - One or more path segments (variadic) to match against panel patterns.
 *               Can be individual segments or arrays of segments.
 * @returns Panel info object, or null if no match
 */
export function useGetPanelByPath(
  ...path: LayoutPath | LayoutPath[]
): RoomPanelInfo | null {
  const {panel} = useGetPanelInfoByPath(...path) ?? {};

  return panel ?? null;
}
