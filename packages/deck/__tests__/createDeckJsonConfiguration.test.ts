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
import {extractColorScaleLegends} from '../src/json/extractColorScaleLegends';
import {prepareDeckDataset} from '../src/prepare/prepareDeckDataset';
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

  it('injects colorScale accessors for GeoArrow layers', () => {
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
            '@@function': 'colorScale',
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

  it('prefers Vector binding when getHexagon is already a @@= accessor', () => {
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
          id: 'h3-hexagons',
          _sqlroomsBinding: {
            dataset: 'earthquakes',
            hexagonColumn: 'h3',
          },
          getHexagon: '@@=h3',
          getFillColor: [56, 189, 248, 161],
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    expect(JSON.stringify(converted.layers[0]?.props.getHexagon)).toBe(
      JSON.stringify(table.getChild('h3')),
    );
  });

  it('compiles getElevation scale range into a linear accessor', () => {
    const pointField = new Field(
      'geom',
      new FixedSizeList(2, new Field('xy', new Float64())),
      true,
      new Map([['ARROW:extension:name', 'geoarrow.point']]),
    );
    const table = new Table(
      new Schema([pointField, new Field('magnitude', new Float64())]),
      {
        geom: vectorFromArray(
          [
            [7.4386, 46.9511],
            [8.5417, 47.3769],
          ],
          pointField.type,
        ),
        magnitude: vectorFromArray([1, 5], new Float64()),
      },
    );
    const converter = createConverter({
      earthquakes: {
        status: 'ready',
        prepared: createPreparedDataset(table),
      },
    });

    const converted = converter.convert({
      layers: [
        {
          '@@type': 'GeoArrowColumnLayer',
          id: 'columns',
          _sqlroomsBinding: {
            dataset: 'earthquakes',
            geometryColumn: 'geom',
          },
          extruded: true,
          elevationScale: 100,
          getElevation: {
            '@@function': 'scale',
            field: 'magnitude',
            type: 'linear',
            domain: 'auto',
            range: [0, 200],
          },
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    const getElevation = converted.layers[0]?.props.getElevation;
    expect(typeof getElevation).toBe('function');

    const batch = table.batches[0]!;
    const elev = getElevation as (info: {
      index: number;
      data: {data: unknown};
      target: number[];
    }) => number;

    expect(elev({index: 0, data: {data: batch}, target: []})).toBeCloseTo(0);
    expect(elev({index: 1, data: {data: batch}, target: []})).toBeCloseTo(200);
  });

  it('compiles getElevation scale for GeoJsonLayer from feature properties', () => {
    const table = new Table({
      geom: vectorFromArray(
        [
          'POLYGON((0 0, 2 0, 2 2, 0 2, 0 0))',
          'POLYGON((4 0, 6 0, 6 2, 4 2, 4 0))',
        ],
        new Utf8(),
      ),
      height: vectorFromArray([10, 30], new Float64()),
    });
    const prepared = prepareDeckDataset({
      datasetId: 'buildings',
      table,
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkt',
    });
    const converter = createConverter({
      buildings: {status: 'ready', prepared},
    });

    const converted = converter.convert({
      layers: [
        {
          '@@type': 'GeoJsonLayer',
          id: 'buildings',
          extruded: true,
          _sqlroomsBinding: {
            dataset: 'buildings',
            geometryColumn: 'geom',
          },
          getElevation: {
            '@@function': 'scale',
            field: 'height',
            type: 'linear',
            domain: 'auto',
            range: [0, 200],
          },
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    const getElevation = converted.layers[0]?.props.getElevation;
    expect(typeof getElevation).toBe('function');

    const elev = getElevation as (object: unknown) => number;
    expect(elev({properties: {height: 10}})).toBeCloseTo(0);
    expect(elev({properties: {height: 30}})).toBeCloseTo(200);
    expect(
      (converted.layers[0]?.props.updateTriggers as {getElevation?: string})
        ?.getElevation,
    ).toContain('height');
  });

  it('keeps explicit getFillColor while still compiling getLineColor colorScale', () => {
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
            '@@function': 'colorScale',
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

  it('compiles generic getColor colorScale accessors', () => {
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
          id: 'points',
          getFillColor: {
            '@@function': 'colorScale',
            field: 'magnitude',
            type: 'sequential',
            scheme: 'Viridis',
            domain: 'auto',
          },
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    expect(typeof converted.layers[0]?.props.getFillColor).toBe('function');
  });

  it('compiles multiple colorScale properties on the same layer', () => {
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
            '@@function': 'colorScale',
            field: 'magnitude',
            type: 'sequential',
            scheme: 'Viridis',
            domain: 'auto',
          },
          getLineColor: {
            '@@function': 'colorScale',
            field: 'magnitude',
            type: 'sequential',
            scheme: 'YlOrRd',
            domain: [0, 10],
          },
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    expect(typeof converted.layers[0]?.props.getFillColor).toBe('function');
    expect(typeof converted.layers[0]?.props.getLineColor).toBe('function');

    const updateTriggers = converted.layers[0]?.props.updateTriggers as
      | Record<string, unknown>
      | undefined;
    expect(updateTriggers?.getFillColor).toBeTruthy();
    expect(updateTriggers?.getLineColor).toBeTruthy();
  });

  it('compiles both getSourceColor and getTargetColor on arc layers', () => {
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
          getSourceColor: {
            '@@function': 'colorScale',
            field: 'magnitude',
            type: 'sequential',
            scheme: 'Blues',
            domain: 'auto',
          },
          getTargetColor: {
            '@@function': 'colorScale',
            field: 'magnitude',
            type: 'sequential',
            scheme: 'Reds',
            domain: 'auto',
          },
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    expect(typeof converted.layers[0]?.props.getSourceColor).toBe('function');
    expect(typeof converted.layers[0]?.props.getTargetColor).toBe('function');
  });

  it('assigns a stable layer id from the dataset so deck.gl can reuse GPU resources', () => {
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
          '@@type': 'GeoArrowHeatmapLayer',
          _sqlroomsBinding: {dataset: 'earthquakes'},
        },
      ],
    }) as {layers: Array<{id?: string; props: Record<string, unknown>}>};

    expect(converted.layers[0]?.id ?? converted.layers[0]?.props.id).toBe(
      'earthquakes',
    );
    expect(converted.layers[0]?.props.colorRange).toEqual(
      expect.arrayContaining([expect.any(Array)]),
    );
    const updateTriggers = converted.layers[0]?.props.updateTriggers as
      | Record<string, unknown>
      | undefined;
    expect(JSON.stringify(updateTriggers?.getWeight ?? null)).not.toBe(
      JSON.stringify(converted.layers[0]?.props.colorRange),
    );
    expect(converted.layers[0]?.props.weightsTextureSize).toBe(512);
  });
});

describe('extractColorScaleLegends', () => {
  function createReadyState(table: Table): PreparedDeckDatasetState {
    return {
      status: 'ready',
      prepared: createPreparedDataset(table),
    };
  }

  it('shows only the fill legend when fill and stroke both have color scales', () => {
    const table = createPointTable();
    const legends = extractColorScaleLegends({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'points',
            _sqlroomsBinding: {dataset: 'earthquakes'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'magnitude',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
            },
            getLineColor: {
              '@@function': 'colorScale',
              field: 'magnitude',
              type: 'sequential',
              scheme: 'YlOrRd',
              domain: 'auto',
            },
          },
        ],
      },
      datasetIds: ['earthquakes'],
      datasetStates: {earthquakes: createReadyState(table)},
    });

    expect(legends).toHaveLength(1);
    expect(legends[0]).toMatchObject({type: 'continuous', title: 'magnitude'});
  });

  it('shows stroke legend only when fill has no color scale', () => {
    const table = createPointTable();
    const legends = extractColorScaleLegends({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'points',
            _sqlroomsBinding: {dataset: 'earthquakes'},
            getFillColor: [56, 189, 248, 180],
            getLineColor: {
              '@@function': 'colorScale',
              field: 'magnitude',
              type: 'sequential',
              scheme: 'YlOrRd',
              domain: 'auto',
              legend: {title: 'Stroke Legend'},
            },
          },
        ],
      },
      datasetIds: ['earthquakes'],
      datasetStates: {earthquakes: createReadyState(table)},
    });

    expect(legends).toHaveLength(1);
    expect(legends[0]!.title).toBe('Stroke Legend');
  });

  it('prefers fill title when both scales exist even if titles differ', () => {
    const table = createPointTable();
    const legends = extractColorScaleLegends({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'points',
            _sqlroomsBinding: {dataset: 'earthquakes'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'magnitude',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
              legend: {title: 'Fill Legend'},
            },
            getLineColor: {
              '@@function': 'colorScale',
              field: 'magnitude',
              type: 'sequential',
              scheme: 'YlOrRd',
              domain: 'auto',
              legend: {title: 'Line Legend'},
            },
          },
        ],
      },
      datasetIds: ['earthquakes'],
      datasetStates: {earthquakes: createReadyState(table)},
    });

    expect(legends).toHaveLength(1);
    expect(legends[0]!.title).toBe('Fill Legend');
  });

  it('dedupes identical color-scale legends on the same layer', () => {
    const table = createPointTable();
    const legends = extractColorScaleLegends({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'points',
            _sqlroomsBinding: {dataset: 'earthquakes'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'magnitude',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
              legend: {title: 'Magnitude'},
            },
            getLineColor: {
              '@@function': 'colorScale',
              field: 'magnitude',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
              legend: {title: 'Magnitude'},
            },
          },
        ],
      },
      datasetIds: ['earthquakes'],
      datasetStates: {earthquakes: createReadyState(table)},
    });

    expect(legends).toHaveLength(1);
    expect(legends[0]!.title).toBe('Magnitude');
  });

  it('keeps legends that share title/field but differ by reverse', () => {
    const table = createPointTable();
    const legends = extractColorScaleLegends({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowArcLayer',
            id: 'arcs',
            _sqlroomsBinding: {
              dataset: 'earthquakes',
              sourceGeometryColumn: 'source_geom',
              targetGeometryColumn: 'target_geom',
            },
            getSourceColor: {
              '@@function': 'colorScale',
              field: 'magnitude',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
              reverse: false,
              legend: {title: 'Magnitude'},
            },
            getTargetColor: {
              '@@function': 'colorScale',
              field: 'magnitude',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
              reverse: true,
              legend: {title: 'Magnitude'},
            },
          },
        ],
      },
      datasetIds: ['earthquakes'],
      datasetStates: {earthquakes: createReadyState(table)},
    });

    expect(legends).toHaveLength(2);
  });

  it('falls back to getLineColor legend when getFillColor field is invalid', () => {
    const table = createPointTable();
    const legends = extractColorScaleLegends({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'points',
            _sqlroomsBinding: {dataset: 'earthquakes'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'nonexistent_column',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
            },
            getLineColor: {
              '@@function': 'colorScale',
              field: 'magnitude',
              type: 'sequential',
              scheme: 'YlOrRd',
              domain: 'auto',
            },
          },
        ],
      },
      datasetIds: ['earthquakes'],
      datasetStates: {earthquakes: createReadyState(table)},
    });

    expect(legends).toHaveLength(1);
    expect(legends[0]!.title).toBe('magnitude');
    expect(legends[0]).toMatchObject({type: 'continuous'});
  });
});

describe('createDeckJsonConfiguration — point layers reject polygon geometry', () => {
  it('rejects WKT polygon footprints on GeoArrowColumnLayer (require ST_Centroid)', () => {
    const table = new Table({
      geom: vectorFromArray(
        [
          'POLYGON((0 0, 2 0, 2 2, 0 2, 0 0))',
          'POLYGON((10 10, 14 10, 14 14, 10 14, 10 10))',
        ],
        new Utf8(),
      ),
      height: vectorFromArray([12, 40], new Float64()),
    });
    const prepared = prepareDeckDataset({
      datasetId: 'buildings',
      table,
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkt',
    });
    const converter = createConverter({
      buildings: {status: 'ready', prepared},
    });

    expect(() =>
      converter.convert({
        layers: [
          {
            '@@type': 'GeoArrowColumnLayer',
            id: 'buildings',
            _sqlroomsBinding: {
              dataset: 'buildings',
              geometryColumn: 'geom',
            },
            getElevation: '@@=height',
          },
        ],
      }),
    ).toThrow(/ST_Centroid|ST_PointOnSurface|Point positions/);
  });

  it('promotes WKT LineString and single-part MultiLineString to PathLayer', () => {
    const table = new Table({
      geom: vectorFromArray(
        ['LINESTRING(0 0, 1 1, 2 0)', 'MULTILINESTRING((10 10, 11 11, 12 12))'],
        new Utf8(),
      ),
      label: vectorFromArray(['a', 'b'], new Utf8()),
    });
    const prepared = prepareDeckDataset({
      datasetId: 'lines',
      table,
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkt',
    });
    const converter = createConverter({
      lines: {status: 'ready', prepared},
    });

    const converted = converter.convert({
      layers: [
        {
          '@@type': 'GeoArrowPathLayer',
          id: 'lines',
          _sqlroomsBinding: {
            dataset: 'lines',
            geometryColumn: 'geom',
          },
          getColor: [255, 0, 0, 255],
          getWidth: 2,
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    const getPath = converted.layers[0]?.props.getPath;
    expect(getPath).toBeDefined();
    expect(converted.layers[0]?.props.data).toBeDefined();
  });

  it('rejects multi-part MultiLineString on PathLayer (no silent stitch)', () => {
    const table = new Table({
      geom: vectorFromArray(
        ['MULTILINESTRING((10 10, 11 11), (12 12, 13 13))'],
        new Utf8(),
      ),
    });
    const prepared = prepareDeckDataset({
      datasetId: 'lines',
      table,
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkt',
    });
    const converter = createConverter({
      lines: {status: 'ready', prepared},
    });

    expect(() =>
      converter.convert({
        layers: [
          {
            '@@type': 'GeoArrowPathLayer',
            id: 'lines',
            _sqlroomsBinding: {
              dataset: 'lines',
              geometryColumn: 'geom',
            },
          },
        ],
      }),
    ).toThrow(/MultiLineString|LineString|promotion|ST_LineMerge|ST_Dump/i);
  });

  it('rejects mixed Point/LineString/Polygon on GeoArrowPolygonLayer with GeoJsonLayer hint', () => {
    const table = new Table({
      geom: vectorFromArray(
        [
          'POINT(0 0)',
          'LINESTRING(0 0, 1 1)',
          'POLYGON((0 0, 2 0, 2 2, 0 2, 0 0))',
        ],
        new Utf8(),
      ),
      kind: vectorFromArray(['point', 'line', 'polygon'], new Utf8()),
    });
    const prepared = prepareDeckDataset({
      datasetId: 'mixed',
      table,
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkt',
    });
    const converter = createConverter({
      mixed: {status: 'ready', prepared},
    });

    expect(() =>
      converter.convert({
        layers: [
          {
            '@@type': 'GeoArrowPolygonLayer',
            id: 'mixed-geom',
            _sqlroomsBinding: {
              dataset: 'mixed',
              geometryColumn: 'geom',
            },
          },
        ],
      }),
    ).toThrow(/GeoJsonLayer|POLYGON|mixed|Sampled geometry types/i);
  });

  it('promotes WKT MultiPolygon to GeoArrowPolygonLayer without flattening parts', () => {
    const table = new Table({
      geom: vectorFromArray(
        [
          'MULTIPOLYGON(((0 0, 2 0, 2 2, 0 2, 0 0)), ((10 10, 12 10, 12 12, 10 12, 10 10)))',
        ],
        new Utf8(),
      ),
    });
    const prepared = prepareDeckDataset({
      datasetId: 'islands',
      table,
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkt',
    });
    const converter = createConverter({
      islands: {status: 'ready', prepared},
    });

    const converted = converter.convert({
      layers: [
        {
          '@@type': 'GeoArrowPolygonLayer',
          id: 'islands',
          _sqlroomsBinding: {
            dataset: 'islands',
            geometryColumn: 'geom',
          },
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    expect(converted.layers[0]?.props.getPolygon).toBeDefined();
    expect(converted.layers[0]?.props.data).toBeDefined();

    const promoted = prepared.getGeoArrowLayerData('geom');
    expect(promoted.encoding).toBe('geoarrow.multipolygon');
    expect(promoted.geometryColumn.get(0)?.length).toBe(2);
  });

  it('promotes mixed Polygon and MultiPolygon WKT on GeoArrowPolygonLayer', () => {
    const table = new Table({
      geom: vectorFromArray(
        [
          'POLYGON((0 0, 2 0, 2 2, 0 2, 0 0))',
          'MULTIPOLYGON(((0 0, 2 0, 2 2, 0 2, 0 0)), ((10 10, 12 10, 12 12, 10 12, 10 10)))',
        ],
        new Utf8(),
      ),
    });
    const prepared = prepareDeckDataset({
      datasetId: 'buildings',
      table,
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkt',
    });
    const converter = createConverter({
      buildings: {status: 'ready', prepared},
    });

    const converted = converter.convert({
      layers: [
        {
          '@@type': 'GeoArrowPolygonLayer',
          id: 'buildings',
          _sqlroomsBinding: {
            dataset: 'buildings',
            geometryColumn: 'geom',
          },
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    expect(converted.layers[0]?.props.getPolygon).toBeDefined();
    const promoted = prepared.getGeoArrowLayerData('geom');
    expect(promoted.encoding).toBe('geoarrow.multipolygon');
    expect(promoted.geometryColumn.get(0)?.length).toBe(1);
    expect(promoted.geometryColumn.get(1)?.length).toBe(2);
  });

  it('promotes MultiPolygon after a Polygon-only sample window', () => {
    const polygonWkt = 'POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))';
    const table = new Table({
      geom: vectorFromArray(
        [
          ...Array.from({length: 100}, () => polygonWkt),
          'MULTIPOLYGON(((0 0, 2 0, 2 2, 0 2, 0 0)), ((10 10, 12 10, 12 12, 10 12, 10 10)))',
        ],
        new Utf8(),
      ),
    });
    const prepared = prepareDeckDataset({
      datasetId: 'buildings',
      table,
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkt',
    });
    const converter = createConverter({
      buildings: {status: 'ready', prepared},
    });

    expect(() =>
      converter.convert({
        layers: [
          {
            '@@type': 'GeoArrowPolygonLayer',
            id: 'buildings',
            _sqlroomsBinding: {
              dataset: 'buildings',
              geometryColumn: 'geom',
            },
          },
        ],
      }),
    ).not.toThrow();
    expect(prepared.getGeoArrowLayerData('geom').encoding).toBe(
      'geoarrow.multipolygon',
    );
  });

  it('preserves MultiPolygon parts through the GeoJsonLayer path', () => {
    const table = new Table({
      geom: vectorFromArray(
        [
          'MULTIPOLYGON(((0 0, 2 0, 2 2, 0 2, 0 0)), ((10 10, 12 10, 12 12, 10 12, 10 10)))',
        ],
        new Utf8(),
      ),
    });
    const prepared = prepareDeckDataset({
      datasetId: 'islands',
      table,
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkt',
    });
    const converter = createConverter({
      islands: {status: 'ready', prepared},
    });

    const converted = converter.convert({
      layers: [
        {
          '@@type': 'GeoJsonLayer',
          id: 'islands',
          _sqlroomsBinding: {
            dataset: 'islands',
            geometryColumn: 'geom',
          },
        },
      ],
    }) as {layers: Array<{props: {data?: unknown}}>};

    const binary = converted.layers[0]?.props.data as {
      polygons: {
        polygonIndices: {value: ArrayLike<number>};
        primitivePolygonIndices: {value: ArrayLike<number>};
      };
    };
    expect(Array.from(binary.polygons.polygonIndices.value)).toEqual([
      0, 5, 10,
    ]);
    expect(Array.from(binary.polygons.primitivePolygonIndices.value)).toEqual([
      0, 5, 10,
    ]);
  });

  it('renders mixed geometries with GeoJsonLayer', () => {
    const table = new Table({
      geom: vectorFromArray(
        [
          'POINT(0 0)',
          'LINESTRING(0 0, 1 1)',
          'POLYGON((0 0, 2 0, 2 2, 0 2, 0 0))',
        ],
        new Utf8(),
      ),
    });
    const prepared = prepareDeckDataset({
      datasetId: 'mixed',
      table,
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkt',
    });
    const converter = createConverter({
      mixed: {status: 'ready', prepared},
    });

    const converted = converter.convert({
      layers: [
        {
          '@@type': 'GeoJsonLayer',
          id: 'mixed-geom',
          _sqlroomsBinding: {
            dataset: 'mixed',
            geometryColumn: 'geom',
          },
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    expect(converted.layers).toHaveLength(1);
    expect(converted.layers[0]?.props.data).toBeDefined();
  });
});
