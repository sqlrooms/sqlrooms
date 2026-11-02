import {describe, expect, jest, test} from '@jest/globals';
import {createBaseRoomSlice, RoomStateProvider} from '@sqlrooms/room-store';
import {tableFromArrays} from 'apache-arrow';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {createStore} from 'zustand/vanilla';
import {createDeckMapConfigForTable} from '../src/mapConfigUtils';
import {useDeckMapFitController} from '../src/mapFit';
import type {DeckJsonMapHandle} from '../src/types';

async function fitMap(
  bounds: [west: number, south: number, east: number, north: number],
  maxZoom?: number,
) {
  const [west, south, east, north] = bounds;
  const result = tableFromArrays({
    min_longitude: [west],
    min_latitude: [south],
    max_longitude: [east],
    max_latitude: [north],
  });
  const executeSql = jest.fn(async () => result);
  const store = createStore((...args) => ({
    ...createBaseRoomSlice()(...args),
    db: {executeSql},
  }));
  const container = document.createElement('div');
  Object.defineProperties(container, {
    clientWidth: {value: 800},
    clientHeight: {value: 600},
  });
  const root = createRoot(container);
  const jumpTo = jest.fn<DeckJsonMapHandle['jumpTo']>();
  const onError = jest.fn();
  const deckMapRef = {current: {jumpTo}};
  const config = createDeckMapConfigForTable({
    tableName: 'places',
    columns: [
      {name: 'lon', type: 'DOUBLE'},
      {name: 'lat', type: 'DOUBLE'},
    ],
  });
  const fitToData = {
    ...config.fitToData!,
    ...(maxZoom === undefined ? {} : {maxZoom}),
  };
  const source = config.datasets.places!.source!;

  function FitMap() {
    useDeckMapFitController({
      scopeId: 'places',
      fitToData,
      source,
      container,
      deckMapRef,
      requestVersion: 0,
      autoFit: true,
      onError,
    });
    return null;
  }

  try {
    await act(async () => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <FitMap />
        </RoomStateProvider>,
      );
    });
    expect(onError).not.toHaveBeenCalled();
    expect(jumpTo).toHaveBeenCalledTimes(1);
    return jumpTo.mock.calls[0]![0];
  } finally {
    await act(async () => root.unmount());
  }
}

describe('useDeckMapFitController zoom limits', () => {
  test('fits a small area beyond zoom 12 for a new map', async () => {
    const view = await fitMap([30.5, 50.4, 30.501, 50.401]);

    expect(view.zoom).toBeGreaterThan(12);
    expect(view.zoom).toBeLessThanOrEqual(18);
  });

  test('caps a tiny extent at the default zoom of 18', async () => {
    const view = await fitMap([30.5, 50.4, 30.500001, 50.400001]);

    expect(view.zoom).toBe(18);
  });

  test.each([0, 8, 12])(
    'honors an explicit zoom cap of %s',
    async (maxZoom) => {
      const view = await fitMap([30.5, 50.4, 30.501, 50.401], maxZoom);

      expect(view.zoom).toBe(maxZoom);
    },
  );

  test('keeps a country-sized extent below zoom 12', async () => {
    const view = await fitMap([22, 44, 40, 53]);

    expect(Number.isFinite(view.zoom)).toBe(true);
    expect(view.zoom).toBeLessThan(12);
  });
});
