import {afterEach, describe, expect, test} from '@jest/globals';
import {createStore} from 'zustand/vanilla';
import {createDeckMapsSlice, DeckMapsSliceConfig} from '../src/DeckMapsSlice';
import {
  createDeckMapDashboardPanelConfig,
  createEmptyDeckMapConfig,
  withDefaultDeckMapStyle,
} from '../src/mapConfig';
import {
  createDeckMapConfigForTable,
  regenerateMapConfigForTable,
} from '../src/mapConfigUtils';

const originalDocument = Object.getOwnPropertyDescriptor(
  globalThis,
  'document',
);
function setAppTheme(theme: 'light' | 'dark') {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: {
        classList: {contains: (value: string) => value === theme},
      },
    },
  });
}

afterEach(() => {
  if (originalDocument)
    Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
});

describe('map basemap selection', () => {
  test('snapshots the active theme for empty, table, and dashboard maps', () => {
    for (const theme of ['dark', 'light'] as const) {
      setAppTheme(theme);
      const config = createEmptyDeckMapConfig();
      expect(config.mapStyle).toBe(theme);
      expect(
        createDeckMapDashboardPanelConfig({spec: {layers: []}, datasets: {}})
          .config.mapStyle,
      ).toBe(theme);
      expect(
        createDeckMapConfigForTable({
          tableName: 'points',
          columns: [
            {name: 'lon', type: 'DOUBLE'},
            {name: 'lat', type: 'DOUBLE'},
          ],
        }).mapStyle,
      ).toBe(theme);
    }
  });

  test('preserves explicit URL and map-prop styles at creation', () => {
    const config = {
      spec: {layers: []},
      datasets: {},
      mapStyle: 'https://example.com/style.json',
    };
    expect(withDefaultDeckMapStyle(config)).toBe(config);
    const propsConfig = {
      spec: {layers: []},
      datasets: {},
      mapProps: {mapStyle: {version: 8, sources: {}, layers: []}},
    };
    expect(withDefaultDeckMapStyle(propsConfig)).toBe(propsConfig);
  });

  test('persists style selection through theme changes, config replacement, and reload', () => {
    setAppTheme('dark');
    const store = createStore(createDeckMapsSlice());
    const maps = store.getState().deckMaps;
    maps.ensureMap('map', {config: {spec: {layers: []}, datasets: {}}});
    setAppTheme('light');
    maps.ensureMap('map');
    maps.updateMap('map', {config: {spec: {layers: []}, datasets: {}}});
    expect(maps.getMap('map')?.config.mapStyle).toBe('dark');
    maps.updateMap('map', {
      config: {...maps.getMap('map')!.config, mapStyle: 'light'},
    });
    const saved = DeckMapsSliceConfig.parse(
      JSON.parse(JSON.stringify(store.getState().deckMaps.config)),
    );
    const restored = createStore(createDeckMapsSlice({config: saved}));
    expect(restored.getState().deckMaps.getMap('map')?.config.mapStyle).toBe(
      'light',
    );
    maps.ensureMap('new-map');
    expect(maps.getMap('new-map')?.config.mapStyle).toBe('light');
  });

  test('keeps a selected basemap when an empty map gets its first dataset', () => {
    setAppTheme('light');
    const config = {...createEmptyDeckMapConfig(), mapStyle: 'dark'};
    const result = regenerateMapConfigForTable(
      {config},
      {
        tableName: 'points',
        table: {table: 'points'},
        columns: [
          {name: 'lon', type: 'DOUBLE'},
          {name: 'lat', type: 'DOUBLE'},
        ],
      },
    );
    expect(result.mapStyle).toBe('dark');
    expect(Object.keys(result.datasets as object)).toEqual(['points']);
  });
});
