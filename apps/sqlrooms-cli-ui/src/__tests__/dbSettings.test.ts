import {describe, expect, jest, test} from '@jest/globals';
import {createDbSlice, DbConnection, type DbSliceState} from '@sqlrooms/db';
import {
  createDbSettingsSlice,
  type DbSettingsSliceState,
} from '@sqlrooms/db-settings';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createStore} from 'zustand/vanilla';

type TestState = BaseRoomStoreState & DbSliceState & DbSettingsSliceState;

const warehouse = DbConnection.parse({
  id: 'warehouse',
  engineId: 'postgres',
  title: 'Warehouse',
  runtimeSupport: 'server',
  requiresBridge: true,
  bridgeId: 'server',
  config: {host: 'localhost', database: 'analytics'},
});

function createTestStore() {
  const fetch = jest
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ok: true})));
  const store = createStore<TestState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    // Settings can be composed before db; the baseline uses the composed state.
    ...createDbSettingsSlice({fetch})(...args),
    ...createDbSlice({
      config: {connections: {[warehouse.id]: warehouse}},
      diagnostics: [{...warehouse, available: false}],
    })(...args),
  }));
  return {store, fetch};
}

describe('database settings use canonical connection definitions', () => {
  test('tracks direct db edits, reverts, additions, removals, and config replacement', () => {
    const {store} = createTestStore();
    const {db, dbSettings} = store.getState();
    expect(dbSettings.hasUnsavedChanges()).toBe(false);

    db.connectors.registerConnection({...warehouse, title: 'Renamed'});
    expect(dbSettings.hasUnsavedChanges()).toBe(true);
    db.connectors.registerConnection(warehouse);
    expect(dbSettings.hasUnsavedChanges()).toBe(false);

    db.connectors.registerConnection({...warehouse, id: 'another'});
    expect(dbSettings.hasUnsavedChanges()).toBe(true);
    db.connectors.removeConnection('another');
    expect(dbSettings.hasUnsavedChanges()).toBe(false);

    db.connectors.removeConnection(warehouse.id);
    expect(dbSettings.hasUnsavedChanges()).toBe(true);
    db.setConfig(db.config);
    expect(dbSettings.hasUnsavedChanges()).toBe(false);

    db.connectors.registerConnection({...warehouse, requiresBridge: false});
    expect(dbSettings.hasUnsavedChanges()).toBe(true);
  });

  test('detects edits before the first dirty check and keeps baselines store-local', () => {
    const first = createTestStore().store;
    const second = createTestStore().store;
    first.getState().db.connectors.removeConnection(warehouse.id);
    expect(first.getState().dbSettings.hasUnsavedChanges()).toBe(true);
    expect(second.getState().dbSettings.hasUnsavedChanges()).toBe(false);
  });

  test('ignores diagnostics, core edits, and changes in key order', () => {
    const {store} = createTestStore();
    const {db, dbSettings} = store.getState();
    db.connectors.setDiagnostics([]);
    db.connectors.registerConnection({
      ...db.config.connections[db.config.coreConnectionId]!,
      title: 'Local DuckDB',
    });
    db.connectors.removeConnection(warehouse.id);
    db.connectors.registerConnection({
      ...warehouse,
      config: {database: 'analytics', host: 'localhost'},
    });
    expect(dbSettings.hasUnsavedChanges()).toBe(false);
  });

  test('saves unavailable definitions, excludes core, and detects later edits', async () => {
    const {store, fetch} = createTestStore();
    const {db, dbSettings} = store.getState();
    const edited = {...warehouse, title: 'Renamed'};
    db.connectors.registerConnection(edited);
    expect(await dbSettings.saveToServer('/instance')).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/instance/api/db/settings', {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({connections: [edited]}),
    });
    expect(dbSettings.hasUnsavedChanges()).toBe(false);
    db.connectors.removeConnection(warehouse.id);
    expect(dbSettings.hasUnsavedChanges()).toBe(true);
    expect(await dbSettings.saveToServer()).toBe(true);
    expect(JSON.parse(fetch.mock.calls[1]![1]!.body as string)).toEqual({
      connections: [],
    });
  });

  test('retains edits during a save and prevents overlapping saves', async () => {
    const {store, fetch} = createTestStore();
    const {db, dbSettings} = store.getState();
    let finishSave!: (response: Response) => void;
    fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSave = resolve;
        }),
    );
    db.connectors.registerConnection({...warehouse, title: 'Submitted'});
    const save = dbSettings.saveToServer();
    db.connectors.registerConnection({
      ...warehouse,
      title: 'Edited during save',
    });
    expect(await dbSettings.saveToServer()).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    finishSave(new Response(JSON.stringify({ok: true})));
    expect(await save).toBe(true);
    expect(store.getState().dbSettings.isSaving).toBe(false);
    expect(dbSettings.hasUnsavedChanges()).toBe(true);
    db.connectors.registerConnection({...warehouse, title: 'Submitted'});
    expect(dbSettings.hasUnsavedChanges()).toBe(false);
  });

  test('a failed save leaves the last successful baseline intact', async () => {
    const {store, fetch} = createTestStore();
    const {db, dbSettings} = store.getState();
    const saved = {...warehouse, title: 'Saved'};
    db.connectors.registerConnection(saved);
    await dbSettings.saveToServer();
    db.connectors.removeConnection(warehouse.id);
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({error: 'Read-only'}), {
        status: 403,
      }),
    );
    expect(await dbSettings.saveToServer()).toBe(false);
    expect(store.getState().dbSettings.lastSaveError).toBe('Read-only');
    expect(dbSettings.hasUnsavedChanges()).toBe(true);
    db.connectors.registerConnection(saved);
    expect(dbSettings.hasUnsavedChanges()).toBe(false);
  });
});
