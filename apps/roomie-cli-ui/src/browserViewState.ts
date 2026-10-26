import {blockDocumentContentToBlocks} from '@sqlrooms/documents';
import {
  createRoomStorePersistence,
  type BaseRoomStore,
} from '@sqlrooms/room-store';
import type {RoomState} from './RoomState';
import {
  RoomieViewState,
  selectRoomieContent,
  selectRoomieViewState,
  type RoomieContent,
} from './stateOwnership';

/** Drop references to removed content after content hydration, before applying preferences. */
export function pruneViewState(
  raw: unknown,
  content: RoomieContent,
): RoomieViewState {
  const view = RoomieViewState.parse(raw);
  const artifacts = content.artifacts.artifactsById;
  const tables = new Set(
    Object.values(content.blockDocuments.artifacts)
      .flatMap((document) => blockDocumentContentToBlocks(document.content))
      .flatMap((block) =>
        block.type === 'statefulBlock' && block.blockType === 'data-table'
          ? [block.blockInstanceId]
          : [],
      ),
  );
  return {
    artifacts: {
      currentArtifactId:
        view.artifacts.currentArtifactId &&
        artifacts[view.artifacts.currentArtifactId]
          ? view.artifacts.currentArtifactId
          : content.artifacts.artifactOrder.find((id) =>
              Boolean(artifacts[id]),
            ),
      pinnedArtifactIds: view.artifacts.pinnedArtifactIds.filter((id) =>
        Boolean(artifacts[id]),
      ),
    },
    tableExplorers: {
      byId: Object.fromEntries(
        Object.entries(view.tableExplorers.byId).filter(([id]) =>
          tables.has(id),
        ),
      ),
    },
  };
}

/** Apply preferences only; a stale browser copy can never replace content. */
export function applyViewState(store: BaseRoomStore<RoomState>, raw: unknown) {
  const view = pruneViewState(raw, selectRoomieContent(store.getState()));
  store.setState((state) => ({
    artifacts: {
      ...state.artifacts,
      config: {...state.artifacts.config, ...view.artifacts},
    },
    tableExplorers: {...state.tableExplorers, config: view.tableExplorers},
  }));
}

/** Hydrate once, then debounce browser-local view saves keyed by workspace. */
export async function initializeBrowserViewState(
  store: BaseRoomStore<RoomState>,
  workspaceId: string,
) {
  const persistence = createRoomStorePersistence<RoomState, RoomieViewState>({
    partialize: selectRoomieViewState,
    load: () => indexedDbView(workspaceId),
    save: async (snapshot) => {
      await indexedDbView(workspaceId, snapshot);
    },
    autosaveDelayMs: 300,
    applySnapshot: (view) => applyViewState(store, view),
  });
  const saved = await persistence.hydrate();
  if (!saved) applyViewState(store, {artifacts: {}, tableExplorers: {}});
  const unsubscribe = persistence.bindStore(store);
  const flushOnHide = () => {
    if (document.visibilityState === 'hidden')
      void persistence.flush().catch(store.getState().room.captureException);
  };
  const beforeUnload = (event: BeforeUnloadEvent) => {
    const {dirty, saving} = persistence.controller.getState();
    if (dirty || saving) {
      event.preventDefault();
      event.returnValue = '';
      void persistence.flush().catch(store.getState().room.captureException);
    }
  };
  document.addEventListener('visibilitychange', flushOnHide);
  window.addEventListener('beforeunload', beforeUnload);
  return {
    ...persistence,
    async dispose() {
      unsubscribe();
      document.removeEventListener('visibilitychange', flushOnHide);
      window.removeEventListener('beforeunload', beforeUnload);
      await persistence.flush();
    },
  };
}

async function indexedDbView(
  key: string,
  value?: string,
): Promise<string | null> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('roomie-view-state', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('workspaces');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  try {
    return await new Promise<string | null>((resolve, reject) => {
      const transaction = db.transaction(
        'workspaces',
        value === undefined ? 'readonly' : 'readwrite',
      );
      const store = transaction.objectStore('workspaces');
      const request =
        value === undefined ? store.get(key) : store.put(value, key);
      transaction.oncomplete = () =>
        resolve(value === undefined ? (request.result ?? null) : value);
      transaction.onabort = () =>
        reject(
          transaction.error ?? new Error('View-state transaction aborted.'),
        );
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
