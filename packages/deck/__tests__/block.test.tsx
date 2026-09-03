import {describe, expect, jest, test} from '@jest/globals';
import {getTableIdentity} from '@sqlrooms/duckdb';
import {createBaseRoomSlice, RoomStateProvider} from '@sqlrooms/room-store';
import {TooltipProvider} from '@sqlrooms/ui';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {createStore} from 'zustand/vanilla';
import {createDeckMapsSlice} from '../src/DeckMapsSlice';
import type {DeckMapConfig} from '../src/mapConfig';
import {resolveDeckMapStyle} from '../src/basemap';

jest.unstable_mockModule('@sqlrooms/documents', () => ({
  useBlockSettingsStore: () => undefined,
}));
jest.unstable_mockModule('../src/DeckMapSurface', () => ({
  DeckMapSurface: () => null,
  directDeckMapDataAdapter: {},
}));

const {DeckMapBlockRenderer} = await import('../src/block');
const table = {
  tableName: 'points',
  table: {table: 'points'},
  columns: [
    {name: 'lon', type: 'DOUBLE'},
    {name: 'lat', type: 'DOUBLE'},
  ],
};

function selectTable(config: DeckMapConfig) {
  const store = createStore((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createDeckMapsSlice({
      config: {mapsById: {map: {id: 'map', title: 'Map', config}}},
    })(...args),
    db: {tables: [table]},
  }));
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    act(() =>
      root.render(
        <RoomStateProvider roomStore={store}>
          <TooltipProvider>
            <DeckMapBlockRenderer mapId="map" />
          </TooltipProvider>
        </RoomStateProvider>,
      ),
    );
    const select = container.querySelector('select')!;
    expect(select).not.toBeNull();
    act(() => {
      select.value = getTableIdentity(table.table);
      select.dispatchEvent(new Event('change', {bubbles: true}));
    });
    return store.getState().deckMaps.getMap('map')!;
  } finally {
    act(() => root.unmount());
  }
}

describe('document map table selection', () => {
  test('preserves the saved basemap and map props while creating a dataset', () => {
    const config: DeckMapConfig = {
      spec: {layers: []},
      datasets: {},
      mapStyle: 'dark',
      mapProps: {minZoom: 2, maxZoom: 12},
    };
    const map = selectTable(config);
    expect(map.selectedTable).toBe(getTableIdentity(table.table));
    expect(Object.keys(map.config.datasets)).toEqual(['points']);
    expect(map.config.mapStyle).toBe(config.mapStyle);
    expect(map.config.mapProps).toEqual(config.mapProps);
  });

  test('preserves a custom style held in map props', () => {
    const mapProps = {
      mapStyle: {version: 8, sources: {}, layers: []},
      maxZoom: 12,
    };
    const map = selectTable({spec: {layers: []}, datasets: {}, mapProps});
    expect(Object.keys(map.config.datasets)).toEqual(['points']);
    expect(map.config.mapStyle).toBeUndefined();
    expect(map.config.mapProps).toEqual(mapProps);
  });

  test('leaves a legacy map without a saved style free to follow the theme', () => {
    const map = selectTable({spec: {layers: []}, datasets: {}});
    expect(Object.keys(map.config.datasets)).toEqual(['points']);
    expect(map.config.mapStyle).toBeUndefined();
    for (const resolvedTheme of ['light', 'dark'] as const) {
      expect(
        resolveDeckMapStyle({
          mapStyle: map.config.mapStyle,
          resolvedTheme,
          fallbackStyles: {light: 'light-style', dark: 'dark-style'},
        }),
      ).toBe(`${resolvedTheme}-style`);
    }
  });
});
