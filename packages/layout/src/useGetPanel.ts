import {useMemo} from 'react';
import {matchNodePathToPanel, MatchResult} from './matchNodePathToPanel';
import {LayoutPath, RoomPanelInfo} from './types';

export function useGetPanelInfo(
  panels: Record<string, RoomPanelInfo>,
  ...path: LayoutPath
): MatchResult<RoomPanelInfo> | null {
  return useMemo(() => matchNodePathToPanel(panels, path), [path, panels]);
}

export function useGetPanel(
  panels: Record<string, RoomPanelInfo>,
  ...path: LayoutPath
): RoomPanelInfo | null {
  const {panel} = useGetPanelInfo(panels, ...path) ?? {};

  return panel ?? null;
}
