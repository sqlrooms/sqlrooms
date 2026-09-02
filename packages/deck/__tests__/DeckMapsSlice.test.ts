import {describe, expect, test} from '@jest/globals';
import {createStore} from 'zustand/vanilla';
import {createDeckMapsSlice, DeckMapsSliceConfig} from '../src/DeckMapsSlice';
import {createProtomapsBasemapProvider} from '../src/protomapsStyles';

describe('DeckMapsSlice', () => {
  test('keeps basemap providers room-scoped and outside persisted map config', () => {
    const basemapProvider = createProtomapsBasemapProvider('test-runtime-key');
    const store = createStore(createDeckMapsSlice({basemapProvider}));
    const otherStore = createStore(createDeckMapsSlice());
    store.getState().deckMaps.ensureMap('map-1');
    const config = DeckMapsSliceConfig.parse(store.getState().deckMaps.config);

    expect(store.getState().deckMaps.basemapProvider).toBe(basemapProvider);
    expect(otherStore.getState().deckMaps.basemapProvider).toBeUndefined();
    expect(JSON.stringify(config)).not.toContain('test-runtime-key');
    expect(config).not.toHaveProperty('basemapProvider');
    store.getState().deckMaps.setConfig(config);
    expect(store.getState().deckMaps.basemapProvider).toBe(basemapProvider);
    const restored = createStore(createDeckMapsSlice({config}));
    expect(restored.getState().deckMaps.config).toEqual(config);
    expect(restored.getState().deckMaps.basemapProvider).toBeUndefined();
  });

  test('keeps runtime issues outside persisted config and removes both lifecycles', () => {
    const store = createStore<any>(createDeckMapsSlice() as any);
    store.getState().deckMaps.ensureMap('map-1', {title: 'Map'});
    store.getState().deckMaps.setSelectedTable('map-1', 'main.places');
    store.getState().deckMaps.reportMapIssue('map-1', {
      kind: 'sql-error',
      message: 'bad query',
      recoverable: true,
    });
    expect(DeckMapsSliceConfig.parse(store.getState().deckMaps.config)).toEqual(
      {
        mapsById: expect.objectContaining({
          'map-1': expect.objectContaining({selectedTable: 'main.places'}),
        }),
      },
    );
    expect(JSON.stringify(store.getState().deckMaps.config)).not.toContain(
      'bad query',
    );
    store.getState().deckMaps.removeMap('map-1');
    expect(store.getState().deckMaps.config.mapsById).toEqual({});
    expect(store.getState().deckMaps.runtime.issuesByMapId).toEqual({});
  });

  test('clears a stale runtime issue when a map becomes empty', () => {
    const store = createStore<any>(createDeckMapsSlice() as any);
    store.getState().deckMaps.ensureMap('map-1', {
      config: {
        spec: {layers: []},
        datasets: {places: {source: {tableName: 'places'}}},
      },
    });
    store.getState().deckMaps.reportMapIssue('map-1', {
      kind: 'sql-error',
      message: 'bad query',
      recoverable: true,
    });

    store.getState().deckMaps.updateMap('map-1', {
      config: {spec: {layers: []}, datasets: {}},
    });

    expect(store.getState().deckMaps.runtime.issuesByMapId).toEqual({});
  });

  test('clears a stale render issue when the map config is replaced', () => {
    const store = createStore<any>(createDeckMapsSlice() as any);
    store.getState().deckMaps.ensureMap('map-1');
    store.getState().deckMaps.reportMapIssue('map-1', {
      kind: 'render-error',
      message: 'invalid layer',
      recoverable: true,
    });

    store.getState().deckMaps.updateMap('map-1', {
      config: {
        spec: {layers: []},
        datasets: {places: {source: {tableName: 'places'}}},
      },
    });

    expect(store.getState().deckMaps.runtime.issuesByMapId).toEqual({});
  });

  test('keeps SQL issues until dataset recovery is reported', () => {
    const store = createStore<any>(createDeckMapsSlice() as any);
    store.getState().deckMaps.ensureMap('map-1');
    store.getState().deckMaps.reportMapIssue('map-1', {
      kind: 'sql-error',
      message: 'bad query',
      recoverable: true,
    });

    store.getState().deckMaps.updateMap('map-1', {
      config: {
        spec: {layers: []},
        datasets: {places: {source: {tableName: 'places'}}},
      },
    });

    expect(
      store.getState().deckMaps.runtime.issuesByMapId['map-1'],
    ).toMatchObject({kind: 'sql-error'});
  });

  test('keeps fit failures when dataset SQL recovery is reported', () => {
    const store = createStore<any>(createDeckMapsSlice() as any);
    store.getState().deckMaps.reportMapIssue('map-1', {
      kind: 'fit-error',
      message: 'missing longitude column',
      recoverable: true,
    });

    store.getState().deckMaps.clearMapIssue('map-1', 'sql-error');
    expect(
      store.getState().deckMaps.runtime.issuesByMapId['map-1'],
    ).toMatchObject({kind: 'fit-error'});

    store.getState().deckMaps.clearMapIssue('map-1', 'fit-error');
    expect(store.getState().deckMaps.runtime.issuesByMapId).toEqual({});
  });

  test('preserves other map object identity when one map config is updated', () => {
    const store = createStore<any>(createDeckMapsSlice() as any);
    store.getState().deckMaps.ensureMap('map-1', {title: 'One'});
    store.getState().deckMaps.ensureMap('map-2', {title: 'Two'});
    const map2Before = store.getState().deckMaps.config.mapsById['map-2'];

    store.getState().deckMaps.updateMap('map-1', {
      config: {
        spec: {layers: [{id: 'a', '@@type': 'GeoArrowScatterplotLayer'}]},
        datasets: {places: {source: {tableName: 'places'}}},
      },
    });

    expect(store.getState().deckMaps.config.mapsById['map-2']).toBe(map2Before);
  });
});
