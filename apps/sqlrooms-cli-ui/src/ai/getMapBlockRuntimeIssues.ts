import {DECK_MAP_DASHBOARD_PANEL_TYPE} from '@sqlrooms/deck';
import type {ChartRuntimeIssue} from '@sqlrooms/mosaic';
import type {RoomState} from '../store-types';

export type MapBlockRuntimeIssue = {
  panelId: string;
  panelTitle: string;
  issue: ChartRuntimeIssue;
};

export function getMapBlockRuntimeIssues(
  state: RoomState,
  mapId: string,
): MapBlockRuntimeIssue[] {
  const dashboard = state.mosaicDashboard.getDashboard(mapId);
  if (!dashboard) {
    return [];
  }

  return dashboard.panels
    .filter((panel) => panel.type === DECK_MAP_DASHBOARD_PANEL_TYPE)
    .map((panel) => {
      const issue = state.mosaicDashboard.getPanelIssue(mapId, panel.id);
      return issue
        ? {
            panelId: panel.id,
            panelTitle: panel.title,
            issue,
          }
        : undefined;
    })
    .filter((item): item is MapBlockRuntimeIssue => item !== undefined);
}

export function formatMapBlockRuntimeIssues(
  runtimeIssues: MapBlockRuntimeIssue[],
): string {
  return runtimeIssues
    .map(
      ({panelId, panelTitle, issue}) =>
        `- panelId: ${panelId}; panelTitle: ${panelTitle}; kind: ${issue.kind}; message: ${issue.message}`,
    )
    .join('\n');
}
