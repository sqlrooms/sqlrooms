import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {renderToStaticMarkup} from 'react-dom/server';
import type {MapProps} from 'react-map-gl/maplibre';
import type {DeckJsonMapProps} from '../src/types';

let renderedMapProps: MapProps | undefined;
let onDeckLoad: (() => void) | undefined;
const setCanvasAttribute = jest.fn();

jest.unstable_mockModule('@deck.gl/mapbox', () => ({
  MapboxOverlay: jest.fn(() => ({
    getCanvas: () => ({setAttribute: setCanvasAttribute}),
    setProps: (props: {onLoad?: () => void}) => {
      onDeckLoad = props.onLoad;
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
  usePreparedDatasetStates: () => ({}),
}));

const {DeckJsonMap} = await import('../src/DeckJsonMap');

function renderMap(
  mapProps?: MapProps,
  interleaved = true,
  deckProps?: DeckJsonMapProps['deckProps'],
) {
  renderToStaticMarkup(
    <DeckJsonMap
      spec={{layers: []}}
      datasets={{points: {arrowTable: undefined}}}
      mapProps={mapProps}
      interleaved={interleaved}
      deckProps={deckProps}
      showLegends={false}
    />,
  );
  return renderedMapProps;
}

describe('DeckJsonMap image capture', () => {
  beforeEach(() => {
    renderedMapProps = undefined;
    onDeckLoad = undefined;
    setCanvasAttribute.mockClear();
  });

  test.each([true, false])(
    'identifies the actual deck canvas for capture (interleaved=%s)',
    (interleaved) => {
      renderMap(undefined, interleaved);
      expect(setCanvasAttribute).not.toHaveBeenCalled();
      onDeckLoad?.();
      expect(setCanvasAttribute).toHaveBeenCalledWith(
        'data-sqlrooms-deck-canvas',
        '',
      );
    },
  );

  test('preserves the host deck onLoad callback', () => {
    const onLoad = jest.fn();
    renderMap(undefined, false, {onLoad});
    onDeckLoad?.();
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(setCanvasAttribute).toHaveBeenCalled();
  });

  test('preserves the basemap and interleaved layer buffer by default', () => {
    expect(renderMap()?.canvasContextAttributes).toEqual({
      preserveDrawingBuffer: true,
    });
  });

  test('retains other host context options while enabling capture', () => {
    expect(
      renderMap({canvasContextAttributes: {antialias: true}})
        ?.canvasContextAttributes,
    ).toEqual({antialias: true, preserveDrawingBuffer: true});
  });

  test('lets hosts explicitly opt out of buffer preservation', () => {
    expect(
      renderMap({canvasContextAttributes: {preserveDrawingBuffer: false}})
        ?.canvasContextAttributes,
    ).toEqual({preserveDrawingBuffer: false});
  });
});
