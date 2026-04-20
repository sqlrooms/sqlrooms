import {JSONConverter} from '@deck.gl/json';
import {
  Field,
  FixedSizeList,
  Float64,
  List,
  Schema,
  Table,
  Utf8,
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
  const sourcePointField = new Field(
    'source_geom',
    new FixedSizeList(2, new Field('xy', new Float64())),
    true,
    new Map([['ARROW:extension:name', 'geoarrow.point']]),
  );
  const targetPointField = new Field(
    'target_geom',
    new FixedSizeList(2, new Field('xy', new Float64())),
    true,
    new Map([['ARROW:extension:name', 'geoarrow.point']]),
  );
  const magnitudeField = new Field('magnitude', new Float64());
  const h3Field = new Field('h3', new Utf8());
  const timestampField = new Field(
    'timestamps',
    new List(new Field('item', new Float64())),
  );
  const schema = new Schema([
    pointField,
    sourcePointField,
    targetPointField,
    magnitudeField,
    h3Field,
    timestampField,
  ]);

  return new Table(schema, {
    geom: vectorFromArray([[7.4386, 46.9511]], pointField.type),
    source_geom: vectorFromArray([[7.4386, 46.9511]], sourcePointField.type),
    target_geom: vectorFromArray([[8.5417, 47.3769]], targetPointField.type),
    magnitude: vectorFromArray([4.4]),
    h3: vectorFromArray(['8928308280fffff']),
    timestamps: vectorFromArray([[1, 2, 3]], timestampField.type),
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
    resolveGeometry: (geometryColumnName = 'geom') => ({
      columnName: geometryColumnName,
      vector: table.getChild(geometryColumnName)!,
      encoding: 'geoarrow.point',
      nativeGeoArrow: true,
    }),
    getGeoArrowLayerData: (geometryColumnName = 'geom') => ({
      table,
      geometryColumnName,
      geometryColumn: table.getChild(geometryColumnName)!,
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
            _sqlroomsBinding: {
              dataset: 'missing',
            },
          },
        ],
      }),
    ).toThrow(
      'Layer "GeoArrowScatterplotLayer" references unknown dataset "missing".',
    );
  });

  it('requires _sqlroomsBinding.dataset when multiple datasets are available', () => {
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
      'Layer "GeoArrowScatterplotLayer" must declare _sqlroomsBinding.dataset when multiple datasets are available.',
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

  it('injects sqlroomsColorScale accessors for GeoArrow layers', () => {
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
          getFillColor: {
            '@@function': 'sqlroomsColorScale',
            field: 'magnitude',
            type: 'sequential',
            scheme: 'YlOrRd',
            domain: [0, 10],
          },
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    const getFillColor = converted.layers[0]?.props.getFillColor as
      | ((info: {index: number}) => number[])
      | undefined;

    expect(getFillColor).toBeTruthy();
    expect(getFillColor?.({index: 0})).toHaveLength(4);
  });

  it('binds explicit source/target geometry columns for GeoArrowArcLayer', () => {
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
          '@@type': 'GeoArrowArcLayer',
          id: 'arcs',
          _sqlroomsBinding: {
            dataset: 'earthquakes',
            sourceGeometryColumn: 'source_geom',
            targetGeometryColumn: 'target_geom',
          },
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    expect(converted.layers[0]?.props.data).toBe(table);
    expect(JSON.stringify(converted.layers[0]?.props.getSourcePosition)).toBe(
      JSON.stringify(table.getChild('source_geom')),
    );
    expect(JSON.stringify(converted.layers[0]?.props.getTargetPosition)).toBe(
      JSON.stringify(table.getChild('target_geom')),
    );
  });

  it('binds index columns for GeoArrowH3HexagonLayer', () => {
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
          '@@type': 'GeoArrowH3HexagonLayer',
          id: 'hexes',
          _sqlroomsBinding: {
            dataset: 'earthquakes',
            hexagonColumn: 'h3',
          },
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    expect(JSON.stringify(converted.layers[0]?.props.getHexagon)).toBe(
      JSON.stringify(table.getChild('h3')),
    );
  });

  it('keeps explicit getFillColor while still compiling getLineColor sqlroomsColorScale', () => {
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
          getFillColor: [1, 2, 3, 4],
          getLineColor: {
            '@@function': 'sqlroomsColorScale',
            field: 'magnitude',
            type: 'sequential',
            scheme: 'YlOrRd',
            domain: [0, 10],
          },
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    expect(converted.layers[0]?.props.getFillColor).toEqual([1, 2, 3, 4]);
    expect(typeof converted.layers[0]?.props.getLineColor).toBe('function');
  });
});
