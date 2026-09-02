import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {renderToStaticMarkup} from 'react-dom/server';
import type {MapProps} from 'react-map-gl/maplibre';

let renderedMapProps: MapProps | undefined;

jest.unstable_mockModule('react-map-gl/maplibre', () => ({
  default: (props: MapProps) => {
    renderedMapProps = props;
    return null;
  },
  useControl: jest.fn(),
}));
jest.unstable_mockModule('../src/datasets/usePreparedDatasetStates', () => ({
  usePreparedDatasetStates: () => ({}),
}));

const {DeckJsonMap} = await import('../src/DeckJsonMap');

function renderMap(mapProps?: MapProps) {
  renderToStaticMarkup(
    <DeckJsonMap
      spec={{layers: []}}
      datasets={{points: {arrowTable: undefined}}}
      mapProps={mapProps}
      showLegends={false}
    />,
  );
  return renderedMapProps;
}

describe('DeckJsonMap image capture', () => {
  beforeEach(() => {
    renderedMapProps = undefined;
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
