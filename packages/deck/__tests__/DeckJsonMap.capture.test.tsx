import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import {createBaseRoomSlice, RoomStateProvider} from '@sqlrooms/room-store';
import {act, useState} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import type {MapProps} from 'react-map-gl/maplibre';
import {createStore} from 'zustand/vanilla';
import type {DeckJsonMapProps, PreparedDeckDatasetState} from '../src/types';

let renderedMapProps: MapProps | undefined;
let onDeckLoad: (() => void) | undefined;
let onDeckRender: ((context: unknown) => void) | undefined;
let datasetStates: Record<string, PreparedDeckDatasetState> = {};
const setCanvasAttribute = jest.fn();

jest.unstable_mockModule('@deck.gl/mapbox', () => ({
  MapboxOverlay: jest.fn(() => ({
    getCanvas: () => ({setAttribute: setCanvasAttribute}),
    setProps: (props: {
      onLoad?: () => void;
      onAfterRender?: (context: unknown) => void;
    }) => {
      onDeckLoad = props.onLoad;
      onDeckRender = props.onAfterRender;
    },
  })),
}));

jest.unstable_mockModule('react-map-gl/maplibre', () => ({
  default: (props: MapProps) => {
    renderedMapProps = props;
    return props.children;
  },
  useControl: (create: () => unknown) => create(),
}));
jest.unstable_mockModule('../src/datasets/usePreparedDatasetStates', () => ({
  usePreparedDatasetStates: () => datasetStates,
}));

const {DeckJsonMap} = await import('../src/DeckJsonMap');

function TestMap(props: DeckJsonMapProps) {
  const [store] = useState(() => createStore(createBaseRoomSlice()));
  return (
    <RoomStateProvider roomStore={store}>
      <DeckJsonMap {...props} />
    </RoomStateProvider>
  );
}

let container: HTMLDivElement;
let root: Root;

async function renderMap(
  mapProps?: MapProps,
  interleaved = true,
  deckProps?: DeckJsonMapProps['deckProps'],
) {
  await act(async () =>
    root.render(
      <TestMap
        spec={{layers: []}}
        datasets={{points: {arrowTable: undefined}}}
        mapProps={mapProps}
        interleaved={interleaved}
        deckProps={deckProps}
        showLegends={false}
      />,
    ),
  );
  return renderedMapProps;
}

describe('DeckJsonMap image capture', () => {
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    renderedMapProps = undefined;
    onDeckLoad = undefined;
    onDeckRender = undefined;
    datasetStates = {};
    setCanvasAttribute.mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  test.each([true, false])(
    'identifies the actual deck canvas for capture (interleaved=%s)',
    async (interleaved) => {
      await renderMap(undefined, interleaved);
      expect(setCanvasAttribute).not.toHaveBeenCalled();
      onDeckLoad?.();
      expect(setCanvasAttribute).toHaveBeenCalledWith(
        'data-sqlrooms-deck-canvas',
        '',
      );
    },
  );

  test('preserves the host deck onLoad callback', async () => {
    const onLoad = jest.fn();
    await renderMap(undefined, false, {onLoad});
    onDeckLoad?.();
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(setCanvasAttribute).toHaveBeenCalled();
  });

  test('preserves the basemap and interleaved layer buffer by default', async () => {
    expect((await renderMap())?.canvasContextAttributes).toEqual({
      preserveDrawingBuffer: true,
    });
  });

  test('retains other host context options while enabling capture', async () => {
    expect(
      (await renderMap({canvasContextAttributes: {antialias: true}}))
        ?.canvasContextAttributes,
    ).toEqual({antialias: true, preserveDrawingBuffer: true});
  });

  test('lets hosts explicitly opt out of buffer preservation', async () => {
    expect(
      (
        await renderMap({
          canvasContextAttributes: {preserveDrawingBuffer: false},
        })
      )?.canvasContextAttributes,
    ).toEqual({preserveDrawingBuffer: false});
  });

  describe('capture readiness', () => {
    const datasets = {points: {arrowTable: undefined}};
    const spec = {layers: []};
    const readyDataset: PreparedDeckDatasetState = {
      status: 'ready',
      prepared: {} as Extract<
        PreparedDeckDatasetState,
        {status: 'ready'}
      >['prepared'],
    };

    function isReady() {
      const markers = Array.from(
        container.querySelectorAll('[data-sqlrooms-map-loading]'),
      );
      return (
        markers.length === 2 &&
        markers.every(
          (marker) =>
            marker.getAttribute('data-sqlrooms-map-loading') === 'false',
        )
      );
    }

    async function render(layers: unknown[], interleaved: boolean) {
      await act(async () =>
        root.render(
          <TestMap
            spec={spec}
            datasets={datasets}
            showLegends={false}
            interleaved={interleaved}
            deckProps={{layers: layers as never}}
          />,
        ),
      );
    }

    async function mapFrame(loaded: boolean) {
      await act(async () => {
        renderedMapProps?.onRender?.({target: {loaded: () => loaded}} as never);
      });
    }

    test.each([true, false])(
      'waits for datasets, tiles, and a loaded deck frame (interleaved=%s)',
      async (interleaved) => {
        const layer = {isLoaded: false};
        const layers = [layer];
        await render(layers, interleaved);
        expect(isReady()).toBe(false);
        await mapFrame(true);
        await act(async () => onDeckRender?.({}));
        expect(isReady()).toBe(false);

        // Even a drawn layer cannot make an unresolved dataset ready.
        layer.isLoaded = true;
        await act(async () => onDeckRender?.({}));
        expect(isReady()).toBe(false);
        datasetStates = {points: readyDataset};
        await render(layers, interleaved);
        await mapFrame(false);
        expect(isReady()).toBe(false);
        await mapFrame(true);
        expect(isReady()).toBe(true);

        layer.isLoaded = false;
        await act(async () => onDeckRender?.({}));
        expect(isReady()).toBe(false);
        layer.isLoaded = true;
        await act(async () => onDeckRender?.({}));
        expect(isReady()).toBe(true);

        await act(async () => renderedMapProps?.onData?.({} as never));
        expect(isReady()).toBe(false);
        await mapFrame(true);
        expect(isReady()).toBe(true);

        // Updating layers invalidates the previous frame until the new layers draw.
        await render([{isLoaded: true}], interleaved);
        expect(isReady()).toBe(false);
        await act(async () => onDeckRender?.({}));
        expect(isReady()).toBe(true);

        datasetStates = {points: {status: 'loading'}};
        await render(layers, interleaved);
        await act(async () => onDeckRender?.({}));
        expect(isReady()).toBe(false);
      },
    );

    test('preserves the host deck onAfterRender callback', async () => {
      const onAfterRender = jest.fn();
      await act(async () =>
        root.render(
          <TestMap
            spec={spec}
            datasets={datasets}
            showLegends={false}
            deckProps={{onAfterRender}}
          />,
        ),
      );
      const context = {};
      await act(async () => onDeckRender?.(context));
      expect(onAfterRender).toHaveBeenCalledWith(context);
    });
  });
});
