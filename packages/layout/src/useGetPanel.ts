import {useMemo} from 'react';
import {getPanelByPath, MatchResult} from './getPanelByPath';
import {LayoutPath, RoomPanelInfo} from './types';
import {useStoreWithLayout} from './LayoutSlice';

/**
 * React hook to get full panel match information from the layout store by path.
 *
 * Matches the provided path against registered panel patterns and returns
 * the complete match result including the panel info, extracted parameters,
 * and resolved panel ID.
 *
 * @param path - One or more path segments (variadic) to match against panel patterns.
 *               Can be individual segments or arrays of segments.
 * @returns Match result with panelId, panel info, and params, or null if no match
 *
 * @example
 * // Simple panel lookup
 * const info = useGetPanelInfoByPath('dashboards');
 * // info: { panelId: 'dashboards', panel: {...}, params: {} }
 *
 * @example
 * // Parameterized panel lookup
 * const info = useGetPanelInfoByPath('dashboards', 'overview', 'users');
 * // If panel pattern is 'dashboards/{dashboardId}/{chartId}':
 * // info: {
 * //   panelId: 'users',
 * //   panel: {...},
 * //   params: { dashboardId: 'overview', chartId: 'users' }
 * // }
 *
 * @example
 * // Using with extracted parameters
 * const info = useGetPanelInfoByPath('users', userId);
 * if (info) {
 *   const { panel, params } = info;
 *   const id = params.userId; // Access extracted parameter
 * }
 */
export function useGetPanelInfoByPath(
  ...path: LayoutPath | LayoutPath[]
): MatchResult<RoomPanelInfo> | null {
  const panels = useStoreWithLayout((s) => s.layout.panels);

  return useMemo(() => getPanelByPath(panels, path), [path, panels]);
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
 *
 * @example
 * // Get panel for a specific path
 * const panel = useGetPanelByPath('dashboards', 'overview');
 * if (panel) {
 *   const Component = panel.component;
 *   const title = panel.title;
 * }
 *
 * @example
 * // Use when you only need the panel info, not params
 * const panel = useGetPanelByPath('settings');
 * return panel ? <panel.component {...props} /> : null;
 *
 * @see useGetPanelInfoByPath - Use when you need panelId or extracted parameters
 */
export function useGetPanelByPath(
  ...path: LayoutPath | LayoutPath[]
): RoomPanelInfo | null {
  const {panel} = useGetPanelInfoByPath(...path) ?? {};

  return panel ?? null;
}
