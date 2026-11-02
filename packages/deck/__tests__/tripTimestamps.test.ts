import {describe, expect, jest, test} from '@jest/globals';
import {JSONConverter} from '@deck.gl/json';
import {DeckTripsLayer} from '../src/json/layers/DeckTripsLayer';
import {createDeckJsonConfiguration} from '../src/json/createDeckJsonConfiguration';
import {tryAggregateWaypointsToLineStrings} from '../src/json/aggregateWaypoints';
import {
  getNormalizedTripTimestampChunk,
  summarizeTripTimestamps,
} from '../src/json/tripTimestamps';
import type {PreparedDeckDataset} from '../src/prepare/types';
import {
  DataType,
  Field,
  FixedSizeList,
  Float32,
  Float64,
  List,
  Table,
  TimestampSecond,
  TimestampMillisecond,
  TimestampMicrosecond,
  TimestampNanosecond,
  Vector,
  makeData,
  vectorFromArray,
} from 'apache-arrow';

function listOfFloats(rows: (number | null)[][]) {
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
  return Array.from(
    timestampBuffer(
      new DeckTripsLayer({
        id: 'trips',
        data: new Table({timestamps}),
        getPath: lineString(points),
        getTimestamps: timestamps,
      }),
    ),
  );
}

function timestampBuffer(layer: DeckTripsLayer) {
  const rendered = layer.renderLayers();
  const sublayer = (Array.isArray(rendered) ? rendered[0] : rendered) as {
    props: {
      data: {attributes: {getTimestamps: {value: Float32Array}}};
    };
  };
  return sublayer.props.data.attributes.getTimestamps.value;
}

function convertTrips(timestamps: Vector, props: Record<string, unknown> = {}) {
  const path = lineString(
    Array.from({length: timestamps.get(0)?.length ?? 0}, (_, i) => [i, i]),
  );
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
        ...props,
        _sqlroomsBinding: {
          dataset: 'trips',
          geometryColumn: 'geom',
          timestampColumn: 'timestamps',
        },
      },
    ],
  }) as {layers: DeckTripsLayer[]};

  return converted.layers[0]!;
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
    const layer = convertTrips(timestamps);

    expect(layer.props._tripsMaxTimestamp).toBeCloseTo(5);
  });

  test('ignores null timestamp values when rebasing valid vertices', () => {
    const start = 1_700_000_000_000;
    const timestamps = vectorFromArray(
      [[start, null, start + 5000]],
      new List(new Field('item', new TimestampMicrosecond(), true)),
    );

    expect(summarizeTripTimestamps(timestamps)).toEqual({
      origin: start,
      divisor: 1000,
      max: 5,
    });
    expect(Array.from(timestampBuffer(convertTrips(timestamps)))).toEqual([
      0, 0, 5,
    ]);
  });

  test.each([1_700_000_000_000, -315_619_200_000, -2000])(
    'preserves typed timestamps and nulls when aggregating scalar waypoints at %s',
    (start) => {
      const table = new Table({
        trip_id: vectorFromArray(['trip', 'trip', 'trip']),
        lon: vectorFromArray([0, 1, 2]),
        lat: vectorFromArray([0, 1, 2]),
        timestamp: vectorFromArray(
          [start, null, start + 5000],
          new TimestampMicrosecond(),
        ),
      });
      const aggregated = tryAggregateWaypointsToLineStrings(table)!;
      const timestamps = aggregated.table.getChild('timestamps')!;

      expect(DataType.isTimestamp(timestamps.data[0]!.children[0]!.type)).toBe(
        true,
      );
      expect(timestamps.get(0).get(1)).toBeNull();
      expect(summarizeTripTimestamps(timestamps)?.max).toBe(5);
      expect(Array.from(timestampBuffer(convertTrips(timestamps)))).toEqual([
        0, 0, 5,
      ]);
    },
  );

  test('keeps relative waypoint times aligned with grouped and ordered paths', () => {
    const table = new Table({
      trip_id: vectorFromArray(['a', 'b', 'a', 'b']),
      lon: vectorFromArray([1, 3, 0, 2]),
      lat: vectorFromArray([1, 3, 0, 2]),
      waypoint_order: vectorFromArray([2, 2, 1, 1]),
      timestamp: vectorFromArray([3, null, 1, 2]),
    });
    const aggregated = tryAggregateWaypointsToLineStrings(table)!;
    const timestamps = aggregated.table.getChild('timestamps')!;

    expect(Array.from(timestamps.get(0))).toEqual([1, 3]);
    expect(Array.from(timestamps.get(1))).toEqual([2, null]);
    expect(summarizeTripTimestamps(timestamps)).toEqual({
      origin: 0,
      divisor: 1,
      max: 3,
    });
    expect(Array.from(getNormalizedTripTimestampChunk(timestamps, 0))).toEqual([
      1, 3, 2, 0,
    ]);
  });

  test('preserves raw sub-millisecond timestamps while aggregating waypoints', () => {
    const timestamp = new Vector([
      makeData({
        type: new TimestampMicrosecond(),
        length: 2,
        data: new BigInt64Array([-1001n, 1001n]),
      }),
    ]);
    const aggregated = tryAggregateWaypointsToLineStrings(
      new Table({
        trip_id: vectorFromArray(['trip', 'trip']),
        lon: vectorFromArray([0, 1]),
        lat: vectorFromArray([0, 1]),
        timestamp,
      }),
    )!;
    const timestamps = aggregated.table.getChild('timestamps')!;

    expect(Array.from(timestamps.get(0).toArray())).toEqual([-1001n, 1001n]);
    expect(summarizeTripTimestamps(timestamps)?.max).toBeCloseTo(0.002002, 9);
  });

  test('ignores the backing values of null list rows', () => {
    const start = 1_700_000_000_000;
    const timestamps = new Vector([
      makeData({
        type: new List(new Field('item', new Float64())),
        length: 2,
        valueOffsets: new Int32Array([0, 2, 4]),
        nullBitmap: new Uint8Array([0b10]),
        nullCount: 1,
        child: makeData({
          type: new Float64(),
          length: 4,
          data: new Float64Array([0, start * 2, start, start + 5000]),
        }),
      }),
    ]);

    expect(timestamps.get(0)).toBeNull();
    expect(summarizeTripTimestamps(timestamps)?.max).toBe(5);
    expect(Array.from(getNormalizedTripTimestampChunk(timestamps, 0))).toEqual([
      0, 0, 0, 5,
    ]);
  });

  test('handles a column without valid timestamps', () => {
    const timestamps = listOfFloats([[null, null]]);

    expect(summarizeTripTimestamps(timestamps)).toBeNull();
    expect(Array.from(getNormalizedTripTimestampChunk(timestamps, 0))).toEqual([
      0, 0,
    ]);
  });

  describe.each([
    new TimestampSecond(),
    new TimestampMillisecond(),
    new TimestampMicrosecond(),
    new TimestampNanosecond(),
  ])('typed %s timestamps', (type) => {
    test.each([-315_619_200_000, 0, 1000])(
      'normalizes a five-second range starting at epoch millisecond %s',
      (start) => {
        const timestamps = vectorFromArray(
          [[start, start + 5000]],
          new List(new Field('item', type)),
        );

        expect(summarizeTripTimestamps(timestamps)).toEqual({
          origin: start,
          divisor: 1000,
          max: 5,
        });
        expect(Array.from(timestampBuffer(convertTrips(timestamps)))).toEqual([
          0, 5,
        ]);
      },
    );
  });

  test.each([1, 1000, 1_000_000])(
    'rebases negative numeric epochs with %s units per second',
    (units) => {
      const start = -315_619_200 * units;
      const timestamps = listOfFloats([[start, start + 5 * units]]);

      expect(Array.from(timestampBuffer(convertTrips(timestamps)))).toEqual([
        0, 5,
      ]);
    },
  );

  test.each([1, 1000, 1_000_000])(
    'normalizes explicit settings for numeric epochs with %s units per second',
    (units) => {
      const start = 1_700_000_000 * units;
      const timestamps = listOfFloats([[start, start + 600 * units]]);
      const layer = convertTrips(timestamps, {
        currentTime: start + 300 * units,
        trailLength: 60 * units,
      });

      expect(layer.props.currentTime).toBe(300);
      expect(layer.props.trailLength).toBe(60);
      expect(Array.from(timestampBuffer(layer))).toEqual([0, 600]);
      const playing = layer.clone({currentTime: 301, trailLength: 120});
      expect(timestampBuffer(playing)).toBe(timestampBuffer(layer));
      const [sublayer] = playing.renderLayers() as {
        props: Record<string, unknown>;
      }[];
      expect(sublayer?.props.currentTime).toBe(301);
      expect(sublayer?.props.trailLength).toBe(120);
    },
  );

  test('uses milliseconds for explicit settings on typed Arrow timestamps', () => {
    const timestamps = microsecondList([
      1_700_000_000_000_000n,
      1_700_000_005_000_000n,
    ]);
    const layer = convertTrips(timestamps, {
      currentTime: 1_700_000_002_000,
      trailLength: 1000,
    });

    expect(layer.props.currentTime).toBe(2);
    expect(layer.props.trailLength).toBe(1);
  });

  test('preserves explicit zero time and trail settings for relative data', () => {
    const layer = convertTrips(listOfFloats([[1, 2]]), {
      currentTime: 0,
      trailLength: 0,
    });

    expect(layer.props.currentTime).toBe(0);
    expect(layer.props.trailLength).toBe(0);
  });

  test('normalizes an explicit epoch-zero playhead within a pre-1970 trip', () => {
    const timestamps = microsecondList([-2_000_000n, 2_000_000n]);
    const layer = convertTrips(timestamps, {currentTime: 0, trailLength: 1000});

    expect(layer.props.currentTime).toBe(2);
    expect(layer.props.trailLength).toBe(1);
  });

  test('normalizes explicit settings for a zero-duration trip', () => {
    const start = 1_700_000_000_000;
    const layer = convertTrips(listOfFloats([[start, start]]), {
      currentTime: start,
      trailLength: 1000,
    });

    expect(layer.props.currentTime).toBe(0);
    expect(layer.props.trailLength).toBe(1);
  });

  test('reuses summaries and buffers across frames and refreshes for new data', () => {
    const timestamps = vectorFromArray(
      [[1, 2]],
      new List(new Field('item', new Float32())),
    );
    const layer = convertTrips(timestamps);
    const values = timestampBuffer(layer);
    const summary = summarizeTripTimestamps(timestamps);
    const reads = jest.spyOn(timestamps.data[0]!.children[0]!, 'getValid');
    try {
      expect(summarizeTripTimestamps(timestamps)).toBe(summary);
      expect(timestampBuffer(layer.clone({currentTime: 1}))).toBe(values);
      expect(reads).not.toHaveBeenCalled();

      const nextTimestamps = listOfFloats([[3, 4]]);
      const next = convertTrips(nextTimestamps);
      expect(timestampBuffer(next)).not.toBe(values);
      expect(Array.from(timestampBuffer(next))).toEqual([3, 4]);
      expect(next.props._tripsMaxTimestamp).toBe(4);
    } finally {
      reads.mockRestore();
    }
  });

  test('uses one origin across chunks with shared child buffers and sliced offsets', () => {
    const start = 1_700_000_000_000;
    const source = listOfFloats([
      [start, start + 5000],
      [start + 100_000, start + 105_000],
      [start + 1_000_000, start + 2_000_000],
    ]);
    const timestamps = new Vector([
      ...source.slice(0, 1).data,
      ...source.slice(1, 2).data,
    ]);

    expect(summarizeTripTimestamps(timestamps)?.max).toBe(105);
    expect(Array.from(getNormalizedTripTimestampChunk(timestamps, 0))).toEqual([
      0, 5,
    ]);
    expect(Array.from(getNormalizedTripTimestampChunk(timestamps, 1))).toEqual([
      100, 105,
    ]);
    const sliced = source.slice(1, 2);
    expect(summarizeTripTimestamps(sliced)?.max).toBe(5);
    expect(Array.from(getNormalizedTripTimestampChunk(sliced, 0))).toEqual([
      0, 5,
    ]);
  });
});
