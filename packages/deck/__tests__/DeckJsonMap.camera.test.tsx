import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {createBaseRoomSlice, RoomStateProvider} from '@sqlrooms/room-store';
import {act, createRef, useState} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import type {MapProps} from 'react-map-gl/maplibre';
import {createStore} from 'zustand/vanilla';
import type {DeckJsonMapHandle, DeckJsonMapProps} from '../src/types';

const jumpTo = jest.fn();
let renderedMapProps: MapProps[] = [];

jest.unstable_mockModule('react-map-gl/maplibre', () => ({
  default: (props: MapProps & {ref?: unknown}) => {
    renderedMapProps.push(props);
    // react-map-gl exposes the MapLibre instance through the forwarded ref.
    const {ref} = props;
    if (typeof ref === 'function') {
      (ref as (instance: unknown) => void)({jumpTo});
    } else if (ref && typeof ref === 'object') {
      (ref as {current: unknown}).current = {jumpTo};
    }
    return null;
  },
  useControl: jest.fn(),
}));
jest.unstable_mockModule('../src/datasets/usePreparedDatasetStates', () => ({
  usePreparedDatasetStates: () => ({}),
}));

const {DeckJsonMap} = await import('../src/DeckJsonMap');

function TestMap(
  props: DeckJsonMapProps & {mapRef?: React.Ref<DeckJsonMapHandle>},
) {
  const {mapRef, ...mapProps} = props;
  const [store] = useState(() => createStore(createBaseRoomSlice()));
  return (
    <RoomStateProvider roomStore={store}>
      <DeckJsonMap ref={mapRef} {...mapProps} />
    </RoomStateProvider>
  );
}

function renderPitchedMap() {
  const handle = createRef<DeckJsonMapHandle>();
  const root: Root = createRoot(document.createElement('div'));
  act(() =>
    root.render(
      <TestMap
        mapRef={handle}
        spec={{initialViewState: {pitch: 50, bearing: 20}, layers: []}}
        datasets={{points: {arrowTable: undefined}}}
        showLegends={false}
      />,
    ),
  );
  return {handle, root};
}

describe('DeckJsonMap authored camera', () => {
  beforeEach(() => {
    jumpTo.mockClear();
    renderedMapProps = [];
  });

  // MapLibre reads initialViewState when it constructs the map, so the
  // authored camera has to be complete on the very first render.
  test('completes an authored pitch-only camera on the first render', () => {
    const {root} = renderPitchedMap();
    try {
      expect(renderedMapProps[0]?.initialViewState).toEqual({
        longitude: 0,
        latitude: 20,
        zoom: 1.5,
        pitch: 50,
        bearing: 20,
      });
    } finally {
      act(() => root.unmount());
    }
  });

  test('seeds the first fit with the authored camera, then keeps the live one', () => {
    const {handle, root} = renderPitchedMap();
    try {
      act(() => handle.current?.jumpTo({longitude: 1, latitude: 2, zoom: 3}));
      expect(jumpTo).toHaveBeenNthCalledWith(1, {
        center: [1, 2],
        zoom: 3,
        pitch: 50,
        bearing: 20,
      });

      act(() => handle.current?.jumpTo({longitude: 4, latitude: 5, zoom: 6}));
      expect(jumpTo).toHaveBeenNthCalledWith(2, {center: [4, 5], zoom: 6});
    } finally {
      act(() => root.unmount());
    }
  });
});
