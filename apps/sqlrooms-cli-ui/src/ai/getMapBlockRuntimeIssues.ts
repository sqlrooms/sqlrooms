import type {DeckMapRuntimeIssue} from '@sqlrooms/deck';
import type {RoomState} from '../store-types';

export type MapBlockRuntimeIssue = {
  mapId: string;
  mapTitle: string;
  issue: DeckMapRuntimeIssue;
};

export function getMapBlockRuntimeIssues(
  state: RoomState,
  mapId: string,
): MapBlockRuntimeIssue[] {
  const issue = state.deckMaps.runtime.issuesByMapId[mapId];
  if (!issue) return [];
  return [
    {mapId, mapTitle: state.deckMaps.getMap(mapId)?.title ?? 'Map', issue},
  ];
}

export function formatMapBlockRuntimeIssues(
  runtimeIssues: MapBlockRuntimeIssue[],
): string {
  return runtimeIssues
    .map(
      ({mapId, mapTitle, issue}) =>
        `- mapId: ${mapId}; mapTitle: ${mapTitle}; kind: ${issue.kind}; message: ${issue.message}`,
    )
    .join('\n');
}
