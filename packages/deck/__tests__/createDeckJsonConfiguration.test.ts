import {JSONConverter} from '@deck.gl/json';
import {
  Field,
  FixedSizeList,
  Float64,
  Schema,
  Table,
  vectorFromArray,
} from 'apache-arrow';
import {createDeckJsonConfiguration} from '../src/json/createDeckJsonConfiguration';
import type {PreparedDeckDataset} from '../src/prepare/types';
import type {PreparedDeckDatasetState} from '../src/types';

function createPointTable() {
  const pointField = new Field(
    'geom',
    new FixedSizeList(2, new Field('xy', new Float64())),
    true,
    new Map([['ARROW:extension:name', 'geoarrow.point']]),
  );
  const magnitudeField = new Field('magnitude', new Float64());
  const schema = new Schema([pointField, magnitudeField]);

  return new Table(schema, {
    geom: vectorFromArray([[7.4386, 46.9511]], pointField.type),
    magnitude: vectorFromArray([4.4]),
  });
}

function createPreparedDataset(table: Table): PreparedDeckDataset {
  const geometryColumn = table.getChild('geom');
  if (!geometryColumn) {
    throw new Error('Expected geom column to exist in test table.');
  }

  return {
    datasetId: 'earthquakes',
    table,
    datasetGeometryColumn: 'geom',
    resolveGeometry: () => ({
      columnName: 'geom',
      vector: geometryColumn,
      encoding: 'geoarrow.point',
      nativeGeoArrow: true,
    }),
    getGeoArrowLayerData: () => ({
      table,
      geometryColumnName: 'geom',
      geometryColumn,
      encoding: 'geoarrow.point',
      source: 'native',
    }),
    getGeoJsonBinaryData: () => ({
      points: {positions: {value: new Float32Array()}},
    }),
  };
}

function createConverter(
  datasetStates: Record<string, PreparedDeckDatasetState>,
  datasetIds = Object.keys(datasetStates),
) {
  return new JSONConverter({
    configuration: createDeckJsonConfiguration({
      datasetStates,
      datasetIds,
    }),
    onJSONChange: () => {},
  });
}

describe('createDeckJsonConfiguration', () => {
  it('injects GeoArrow data and geometry accessors for a bound dataset', () => {
    const table = createPointTable();
    const converter = createConverter({
      earthquakes: {
        status: 'ready',
        prepared: createPreparedDataset(table),
      },
    });

    const converted = converter.convert({
      layers: [
        {
          '@@type': 'GeoArrowScatterplotLayer',
          id: 'earthquakes',
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    expect(converted.layers).toHaveLength(1);
    const firstLayer = converted.layers[0]!;
    expect(firstLayer.props.data).toBe(table);
    expect(firstLayer.props.getPosition).toBeTruthy();
  });

  it('throws for unknown dataset ids', () => {
    const converter = createConverter({});

    expect(() =>
      converter.convert({
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'earthquakes',
            _sqlrooms: {
              dataset: 'missing',
            },
          },
        ],
      }),
    ).toThrow(
      'Layer "GeoArrowScatterplotLayer" references unknown dataset "missing".',
    );
  });

  it('requires _sqlrooms.dataset when multiple datasets are available', () => {
    const table = createPointTable();
    const converter = createConverter({
      earthquakes: {
        status: 'ready',
        prepared: createPreparedDataset(table),
      },
      faults: {
        status: 'loading',
      },
    });

    expect(() =>
      converter.convert({
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'earthquakes',
          },
        ],
      }),
    ).toThrow(
      'Layer "GeoArrowScatterplotLayer" must declare _sqlrooms.dataset when multiple datasets are available.',
    );
  });

  it('evaluates GeoArrow array expressions against Arrow column values', () => {
    const table = createPointTable();
    const converter = createConverter({
      earthquakes: {
        status: 'ready',
        prepared: createPreparedDataset(table),
      },
    });

    const converted = converter.convert({
      layers: [
        {
          '@@type': 'GeoArrowScatterplotLayer',
          id: 'earthquakes',
          getFillColor: '@@=[Magnitude >= 4 ? 255 : 0, 120, 60, 180]',
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    const getFillColor = converted.layers[0]?.props.getFillColor as
      | ((info: {
          index: number;
          data: {data: Table};
          target: number[];
        }) => number[])
      | undefined;

    expect(getFillColor).toBeTruthy();
    expect(
      getFillColor?.({
        index: 0,
        data: {data: table.batches[0]!},
        target: [0, 0, 0, 0],
      }),
    ).toEqual([255, 120, 60, 180]);
  });
});
