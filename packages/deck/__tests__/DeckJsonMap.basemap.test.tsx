import {describe, expect, jest, test} from '@jest/globals';
import {createBaseRoomSlice, RoomStateProvider} from '@sqlrooms/room-store';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import type {MapProps} from 'react-map-gl/maplibre';
import {createStore} from 'zustand/vanilla';
import {createDeckMapsSlice} from '../src/DeckMapsSlice';
import type {DeckMapBasemapProvider} from '../src/basemap';

// Keep the real room-store and style resolution; replace only the WebGL map
// and dataset preparation, which are unrelated to provider selection.
const renderMap = jest.fn<(props: MapProps) => React.ReactNode>(() => (
  <div data-testid="map" />
));
jest.unstable_mockModule('react-map-gl/maplibre', () => ({
  default: renderMap,
  useControl: jest.fn(),
}));
jest.unstable_mockModule('../src/datasets/usePreparedDatasetStates', () => ({
  usePreparedDatasetStates: () => ({}),
}));

const {DeckJsonMap} = await import('../src/DeckJsonMap');

function renderMapWithProviders(
  roomProvider?: DeckMapBasemapProvider,
  propProvider?: DeckMapBasemapProvider,
  mapStyle = 'dark',
) {
  const store = createStore((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...(roomProvider
      ? createDeckMapsSlice({basemapProvider: roomProvider})(...args)
      : {}),
  }));
  renderMap.mockClear();
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    act(() =>
      root.render(
        <RoomStateProvider roomStore={store}>
          <DeckJsonMap
            spec={{layers: []}}
            datasets={{points: {sqlQuery: 'SELECT 1 AS id'}}}
            mapStyle={mapStyle}
            basemapProvider={propProvider}
            showLegends={false}
          />
        </RoomStateProvider>,
      ),
    );
    return {
      markup: container.innerHTML,
      style: renderMap.mock.calls[0]?.[0].mapStyle,
    };
  } finally {
    act(() => root.unmount());
  }
}

describe('DeckJsonMap basemap providers', () => {
  test('uses a per-map provider before the room provider', () => {
    const roomProvider = jest.fn(() => 'https://example.com/room.json');
    const propProvider = jest.fn(() => 'https://example.com/map.json');
    const {markup, style} = renderMapWithProviders(roomProvider, propProvider);
    expect(style).toBe('https://example.com/map.json');
    expect(propProvider).toHaveBeenCalledWith('dark');
    expect(roomProvider).not.toHaveBeenCalled();
    expect(markup).not.toContain('Basemap unavailable');
  });

  test('inherits the room provider when there is no prop override', () => {
    const provider = jest.fn(() => 'https://example.com/room.json');
    const {markup, style} = renderMapWithProviders(provider);
    expect(style).toBe('https://example.com/room.json');
    expect(provider).toHaveBeenCalledWith('dark');
    expect(markup).not.toContain('Basemap unavailable');
  });

  test('supports a per-map provider in a room without the Deck maps slice', () => {
    const {style} = renderMapWithProviders(
      undefined,
      () => 'https://example.com/map.json',
    );
    expect(style).toBe('https://example.com/map.json');
  });

  test.each([
    ['light', 'positron'],
    ['dark', 'dark'],
    ['protomaps-light', 'positron'],
    ['protomaps-dark', 'dark'],
  ])(
    'loads OpenFreeMap for saved style %s without a provider or key',
    (id, expected) => {
      const {markup, style} = renderMapWithProviders(undefined, undefined, id);
      expect(style).toBe(`https://tiles.openfreemap.org/styles/${expected}`);
      expect(markup).not.toContain('Basemap unavailable');
    },
  );

  test('falls back to OpenFreeMap when an optional provider has no style', () => {
    const {style} = renderMapWithProviders(() => undefined);
    expect(style).toBe('https://tiles.openfreemap.org/styles/dark');
  });
});
