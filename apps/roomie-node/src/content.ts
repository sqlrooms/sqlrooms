import {HtmlAppState, HtmlAppRevision} from '@sqlrooms/app-runtime';
import {LoroDoc} from 'loro-crdt';
import {Mirror, schema} from 'loro-mirror';
import {
  RoomieContent,
  selectRoomieContent,
} from '../../roomie-cli-ui/src/stateOwnership';
import type {RoomState} from '../../roomie-cli-ui/src/RoomState';
import type {StoreApi} from 'zustand';

// Explicit content fields. Document bodies stay opaque until the editor-aware
// Loro workstream lands. No ambient selection or table explorer preferences.
const contentSchema = schema({
  artifacts: schema.LoroMap({
    artifactsById: schema.Any(),
    artifactOrder: schema.LoroList(schema.String()),
  }),
  blockDocuments: schema.LoroMap({artifacts: schema.Any()}),
  mosaicDashboard: schema.LoroMap({dashboardsById: schema.Any()}),
  htmlApps: schema.LoroMap({appsById: schema.Any()}),
});

/** Reconstruct a new document and mirror; never import rejected operations. */
export function createContent(
  store: StoreApi<RoomState>,
  updates: Uint8Array[],
) {
  const doc = new LoroDoc();
  for (const update of updates) {
    const imported = doc.import(update);
    if (imported.pending?.size)
      throw new Error('Incomplete committed Loro history.');
  }
  const mirror = new Mirror({
    doc,
    schema: contentSchema,
    initialState: selectRoomieContent(store.getState()),
  });
  if (updates.length) {
    // Mirror's view stamps $cid on objects (including record dictionaries).
    // Loro's JSON projection excludes those runtime container annotations.
    const value = parseStoredContent(doc.toJSON());
    store.setState((state) => ({
      artifacts: {
        ...state.artifacts,
        config: {...state.artifacts.config, ...value.artifacts},
      },
      blockDocuments: {...state.blockDocuments, config: value.blockDocuments},
      mosaicDashboard: {
        ...state.mosaicDashboard,
        config: value.mosaicDashboard,
      },
      htmlApps: {...state.htmlApps, config: value.htmlApps},
    }));
  }
  // No automatic persistence or transport subscriptions are attached to this
  // doc. The host alone pushes and publishes at its durable commit boundary.
  return {
    doc,
    hasHistory: updates.length > 0,
    push() {
      // Omit undefined object properties before the opaque Loro Any boundary;
      // otherwise Loro serializes them as null and optional fields fail recovery.
      mirror.setState(
        JSON.parse(JSON.stringify(selectRoomieContent(store.getState()))),
      );
    },
    dispose() {
      mirror.dispose();
      doc.free();
    },
  };
}

/** Read older Loro HTML records where absent optional fields were encoded as null. */
export function parseStoredContent(raw: unknown): RoomieContent {
  const value = structuredClone(raw) as {
    htmlApps?: {appsById?: Record<string, Record<string, unknown>>};
  };
  const normalize = (
    record: Record<string, unknown>,
    shape: Record<
      string,
      {isOptional(): boolean; safeParse(value: unknown): {success: boolean}}
    >,
  ) => {
    for (const [key, field] of Object.entries(shape))
      if (
        record[key] === null &&
        field.isOptional() &&
        !field.safeParse(null).success
      )
        delete record[key];
  };
  for (const app of Object.values(value?.htmlApps?.appsById ?? {})) {
    normalize(app, HtmlAppState.shape);
    if (Array.isArray(app.revisions))
      for (const revision of app.revisions)
        normalize(revision, HtmlAppRevision.shape);
  }
  return RoomieContent.parse(value);
}
