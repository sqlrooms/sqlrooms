import {z} from 'zod';
import {sliceSchemas} from './model';
import type {RoomState} from './RoomState';

/** Explicit persisted field ownership; additions must pass the ownership test. */
export const contentSchemas = {
  artifacts: sliceSchemas.artifacts.pick({
    artifactsById: true,
    artifactOrder: true,
  }),
  blockDocuments: sliceSchemas.blockDocuments.pick({artifacts: true}),
  mosaicDashboard: sliceSchemas.mosaicDashboard.pick({dashboardsById: true}),
  htmlApps: sliceSchemas.htmlApps.pick({appsById: true}),
};

/** Only these fields may be saved in browser-local storage. */
export const viewSchemas = {
  artifacts: sliceSchemas.artifacts.pick({
    currentArtifactId: true,
    pinnedArtifactIds: true,
  }),
  tableExplorers: sliceSchemas.tableExplorers.pick({byId: true}),
};

/** Content and view schemas never overlap, including during hydration. */
export const RoomieContent = z.object(contentSchemas);
export type RoomieContent = z.infer<typeof RoomieContent>;
export const RoomieViewState = z.object(viewSchemas);
export type RoomieViewState = z.infer<typeof RoomieViewState>;

/** Return an owned copy with no store methods or browser selections. */
export function selectRoomieContent(state: RoomState): RoomieContent {
  return structuredClone(
    RoomieContent.parse({
      artifacts: state.artifacts.config,
      blockDocuments: state.blockDocuments.config,
      mosaicDashboard: state.mosaicDashboard.config,
      htmlApps: state.htmlApps.config,
    }),
  );
}

/** Read the browser-owned portion of the persisted slice schemas. */
export function selectRoomieViewState(state: RoomState): RoomieViewState {
  return RoomieViewState.parse({
    artifacts: state.artifacts.config,
    tableExplorers: state.tableExplorers.config,
  });
}
