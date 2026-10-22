import {describe, expect, test} from '@jest/globals';
import {JSONConverter} from '@deck.gl/json';
import {DeckTripsLayer} from '../src/json/layers/DeckTripsLayer';
import {createDeckJsonConfiguration} from '../src/json/createDeckJsonConfiguration';
import {summarizeTripTimestamps} from '../src/json/tripTimestamps';
import type {PreparedDeckDataset} from '../src/prepare/types';
import {
  Field,
  FixedSizeList,
  Float64,
  List,
  Table,
  TimestampMicrosecond,
  Vector,
  makeData,
  vectorFromArray,
} from 'apache-arrow';

function listOfFloats(rows: number[][]) {
  const field = new Field(
    'timestamps',
    new List(new Field('item', new Float64())),
  );
  return vectorFromArray(rows, field.type);
}

function lineString(points: Array<[number, number]>) {
  const coordField = new Field('xy', new Float64(), false);
  const vertexType = new FixedSizeList(2, coordField);
  const vertexField = new Field('', vertexType, true);
  const lineStringType = new List(vertexField);
  const flat = new Float64Array(points.length * 2);
  points.forEach(([lon, lat], index) => {
    flat[index * 2] = lon;
    flat[index * 2 + 1] = lat;
  });
  const coordinates = makeData({
    type: new Float64(),
    length: flat.length,
    data: flat,
  });
  const vertices = makeData({
    type: vertexType,
    length: points.length,
    child: coordinates,
  });
  return new Vector([
    makeData({
      type: lineStringType,
      length: 1,
      valueOffsets: new Int32Array([0, points.length]),
      child: vertices,
    }),
  ]);
}

function microsecondList(values: bigint[]) {
  const itemType = new TimestampMicrosecond();
  const valuesData = makeData({
    type: itemType,
    length: values.length,
    data: BigInt64Array.from(values),
  });
  return new Vector([
    makeData({
      type: new List(new Field('item', itemType, true)),
      length: 1,
      valueOffsets: new Int32Array([0, values.length]),
      child: valuesData,
    }),
  ]);
}

function uploadedTimestamps(
  timestamps: Vector,
  points: Array<[number, number]>,
) {
  const rendered = new DeckTripsLayer({
    id: 'trips',
    data: new Table({timestamps}),
    getPath: lineString(points),
    getTimestamps: timestamps,
  }).renderLayers();
  const layer = (Array.isArray(rendered) ? rendered[0] : rendered) as {
    props: {
      data: {attributes: {getTimestamps: {value: Float32Array}}};
    };
  };
  return Array.from(layer.props.data.attributes.getTimestamps.value);
}

describe('trip timestamps', () => {
  test('leaves a short relative series unchanged', () => {
    const timestamps = listOfFloats([[1, 2, 3]]);
    expect(summarizeTripTimestamps(timestamps)).toEqual({
      origin: 0,
      divisor: 1,
      max: 3,
    });
    expect(
      uploadedTimestamps(timestamps, [
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
    ).toEqual([1, 2, 3]);
  });

  test('rebases DuckDB microsecond timestamps to relative seconds', () => {
    const start = 1_700_000_000_000_000n;
    const timestamps = microsecondList([start, start + 5_000_000n]);
    const summary = summarizeTripTimestamps(timestamps);
    expect(summary?.max).toBeCloseTo(5);
    expect(summary?.divisor).toBe(1000);
    expect(
      uploadedTimestamps(timestamps, [
        [0, 0],
        [1, 1],
      ]),
    ).toEqual([0, 5]);
  });

  test('sets the animation length from the rebased timestamp', () => {
    const start = 1_700_000_000_000_000n;
    const timestamps = microsecondList([start, start + 5_000_000n]);
    const path = lineString([
      [0, 0],
      [1, 1],
    ]);
    const table = new Table({geom: path, timestamps});
    const prepared: PreparedDeckDataset = {
      datasetId: 'trips',
      table,
      datasetGeometryColumn: 'geom',
      resolveGeometry: () => ({
        columnName: 'geom',
        vector: path,
        encoding: 'geoarrow.linestring',
        nativeGeoArrow: true,
      }),
      getGeoArrowLayerData: () => ({
        table,
        geometryColumnName: 'geom',
        geometryColumn: path,
        encoding: 'geoarrow.linestring',
        source: 'native',
      }),
      getGeoJsonBinaryData: () => ({
        points: {positions: {value: new Float32Array()}},
      }),
    };
    const converted = new JSONConverter({
      configuration: createDeckJsonConfiguration({
        datasetIds: ['trips'],
        datasetStates: {trips: {status: 'ready', prepared}},
      }),
      onJSONChange: () => {},
    }).convert({
      layers: [
        {
          '@@type': 'GeoArrowTripsLayer',
          _sqlroomsBinding: {
            dataset: 'trips',
            geometryColumn: 'geom',
            timestampColumn: 'timestamps',
          },
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    expect(converted.layers[0]?.props._tripsMaxTimestamp).toBeCloseTo(5);
  });
});
