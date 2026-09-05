import {jest} from '@jest/globals';
import {createDeckMapPointTransformSql} from '@sqlrooms/deck';
import {makeQualifiedTableName} from '@sqlrooms/duckdb';
import {createCliBlockDocumentCommands} from '../createCliBlockDocumentCommands';
import {
  DEFAULT_CLI_CAPABILITY_PROFILE,
  EXPERIMENTAL_CLI_CAPABILITY_PROFILE,
  DOCUMENT_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
} from '../profiles';

const table = {
  table: makeQualifiedTableName({schema: 'main', table: 'earthquakes'}),
  tableName: 'earthquakes',
  schema: 'main',
  isView: false,
  columns: [
    {name: 'longitude', type: 'DOUBLE'},
    {name: 'latitude', type: 'DOUBLE'},
  ],
};

function command(id: string) {
  const result = createCliBlockDocumentCommands().find(
    (item) => item.id === id,
  );
  if (!result) throw new Error(`Missing ${id}`);
  return result;
}

function profileCommand(
  id: string,
  statefulBlockTypes: readonly (
    | 'dashboard'
    | 'data-table'
    | 'html-app'
    | 'map'
  )[],
) {
  const result = createCliBlockDocumentCommands({statefulBlockTypes}).find(
    (item) => item.id === id,
  );
  if (!result) throw new Error(`Missing ${id}`);
  return result;
}

function setup() {
  const blocks: any[] = [
    {
      id: 'block-1',
      type: 'statefulBlock',
      blockType: 'map',
      blockInstanceId: 'map-1',
      caption: 'Earthquake Explorer',
    },
  ];
  const mapsById: Record<string, any> = {
    'map-1': {
      id: 'map-1',
      title: 'Earthquake Explorer',
      config: {
        spec: {
          layers: [
            {
              '@@type': 'GeoArrowScatterplotLayer',
              id: 'earthquakes',
              _sqlroomsBinding: {dataset: 'earthquakes'},
            },
            {
              '@@type': 'GeoArrowHeatmapLayer',
              id: 'stale-heatmap',
              _sqlroomsBinding: {dataset: 'stale'},
            },
          ],
        },
        datasets: {
          earthquakes: {source: {tableName: 'earthquakes'}},
          stale: {source: {tableName: 'missing_table'}},
        },
      },
    },
  };
  const invokeCommand = jest.fn(async (id: string, input: any) => {
    if (id === 'document.create-stateful-block') {
      return {
        success: true,
        commandId: id,
        data: {
          blockId: `${input.blockType}-block`,
          blockInstanceId:
            input.blockInstanceId ?? `${input.blockType}-instance`,
        },
      };
    }
    return {success: true, commandId: id, data: input};
  });
  const state: any = {
    commands: {invokeCommand},
    artifacts: {
      getArtifact: () => ({
        id: 'document-1',
        type: 'document',
        title: 'Document',
      }),
    },
    blockDocuments: {
      ensureBlockDocument: jest.fn(),
      getBlocks: () => blocks,
      updateBlock: jest.fn(() => true),
    },
    db: {
      findTable: (name: string) => (name === 'earthquakes' ? table : undefined),
    },
    deckMaps: {
      config: {mapsById},
      getMap: (id: string) => mapsById[id],
      ensureMap: jest.fn((id: string, options: any) => {
        mapsById[id] ??= {
          id,
          title: options.title,
          config: {spec: {}, datasets: {}},
        };
      }),
      updateMap: jest.fn((id: string, patch: any) =>
        Object.assign(mapsById[id], patch),
      ),
    },
    mosaicDashboard: {ensureDashboard: jest.fn()},
  };
  return {state, invokeCommand, mapsById};
}

describe('createCliBlockDocumentCommands', () => {
  it('only exposes block-creating commands enabled by the profile', () => {
    const defaultCommandIds = createCliBlockDocumentCommands({
      statefulBlockTypes: DEFAULT_CLI_CAPABILITY_PROFILE.blocks.stateful,
    }).map(({id}) => id);
    expect(defaultCommandIds).toEqual(
      expect.arrayContaining([
        'document.add-dashboard-block',
        'document.add-data-table-block',
      ]),
    );
    expect(defaultCommandIds).not.toContain('document.add-html-app-block');
    expect(defaultCommandIds).not.toContain('document.add-map-block');

    const experimentalCommandIds = createCliBlockDocumentCommands({
      statefulBlockTypes: EXPERIMENTAL_CLI_CAPABILITY_PROFILE.blocks.stateful,
    }).map(({id}) => id);
    expect(experimentalCommandIds).toEqual(
      expect.arrayContaining([
        'document.add-dashboard-block',
        'document.add-data-table-block',
        'document.add-html-app-block',
        'document.add-map-block',
      ]),
    );

    const documentCommandIds = createCliBlockDocumentCommands({
      statefulBlockTypes:
        DOCUMENT_CHARTS_MAPS_CLI_CAPABILITY_PROFILE.blocks.stateful,
    }).map(({id}) => id);
    expect(documentCommandIds).toEqual([
      'document.update-block-metadata',
      'document.add-map-block',
    ]);
  });

  it('rejects metadata edits for stateful blocks disabled by the profile', async () => {
    const {state} = setup();
    state.blockDocuments.getBlocks = () => [
      {
        id: 'dashboard-block',
        type: 'statefulBlock',
        blockType: 'dashboard',
        blockInstanceId: 'dashboard-1',
        caption: 'Dashboard',
      },
    ];
    const updateMetadata = profileCommand(
      'document.update-block-metadata',
      DOCUMENT_CHARTS_MAPS_CLI_CAPABILITY_PROFILE.blocks.stateful,
    );

    expect(() =>
      updateMetadata.execute({getState: () => state} as any, {
        blockDocumentId: 'document-1',
        blockId: 'dashboard-block',
        caption: 'Changed',
      }),
    ).toThrow(
      'Stateful block type dashboard is not available in the selected capability profile',
    );
    expect(state.blockDocuments.updateBlock).not.toHaveBeenCalled();
  });

  it('creates a direct document map without a model or dashboard command', async () => {
    const {state, invokeCommand, mapsById} = setup();
    const result = await command('document.add-map-block').execute(
      {getState: () => state} as any,
      {
        blockDocumentId: 'document-1',
        title: 'New Earthquake Map',
        tableName: 'earthquakes',
        config: {
          datasets: {earthquakes: {source: {tableName: 'earthquakes'}}},
          spec: {
            layers: [
              {
                '@@type': 'GeoArrowScatterplotLayer',
                _sqlroomsBinding: {dataset: 'earthquakes'},
              },
            ],
          },
        },
      },
    );

    expect(result).toMatchObject({success: true});
    const mapId = (result as any).data.mapId as string;
    expect(mapsById[mapId]).toMatchObject({title: 'New Earthquake Map'});
    expect(mapsById[mapId].config.datasets.earthquakes.source.tableName).toBe(
      '"main"."earthquakes"',
    );
    expect(invokeCommand).toHaveBeenCalledWith(
      'document.create-stateful-block',
      expect.objectContaining({blockType: 'map', blockInstanceId: mapId}),
      expect.anything(),
    );
    expect(
      invokeCommand.mock.calls.some(([id]) =>
        String(id).startsWith('dashboard.'),
      ),
    ).toBe(false);
  });

  it('generates canonical point geometry from structured provenance', async () => {
    const {state, mapsById} = setup();
    const result = await command('document.add-map-block').execute(
      {getState: () => state} as any,
      {
        blockDocumentId: 'document-1',
        title: 'Earthquake Points',
        tableName: 'earthquakes',
        pointBinding: {
          dataset: 'earthquakes',
          longitudeColumn: 'longitude',
          latitudeColumn: 'latitude',
          geometryColumn: 'geom',
        },
        config: {
          datasets: {
            earthquakes: {
              source: {
                tableName: 'earthquakes',
                transformSql:
                  'SELECT * EXCLUDE (latitude, longitude), ST_AsWKB(ST_Point(longitude, latitude)) AS geom FROM __sqlrooms_source',
              },
            },
          },
          spec: {
            layers: [
              {
                '@@type': 'GeoArrowScatterplotLayer',
                _sqlroomsBinding: {dataset: 'earthquakes'},
              },
            ],
          },
        },
      },
    );

    expect(result).toMatchObject({success: true});
    const mapId = (result as any).data.mapId as string;
    const config = mapsById[mapId].config;
    expect(config.datasets.earthquakes).toMatchObject({
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkb',
      source: {
        tableName: '"main"."earthquakes"',
        transformSql: createDeckMapPointTransformSql({
          longitudeColumn: 'longitude',
          latitudeColumn: 'latitude',
          geometryColumn: 'geom',
        }),
      },
    });
    expect(config.spec.layers[0]._sqlroomsBinding).toEqual({
      dataset: 'earthquakes',
      geometryColumn: 'geom',
    });
    expect(config.fitToData).toMatchObject({
      dataset: 'earthquakes',
      geometryColumn: 'geom',
    });
  });

  it('updates document maps as resources without dashboard commands or panelId', async () => {
    const {state, invokeCommand, mapsById} = setup();
    const result = await command('document.add-map-block').execute(
      {getState: () => state} as any,
      {
        blockDocumentId: 'document-1',
        mapId: 'map-1',
        reasoning: 'change colors',
        replaceLayers: true,
        replaceDatasets: true,
        config: {
          spec: {
            layers: [
              {
                '@@type': 'GeoArrowScatterplotLayer',
                _sqlroomsBinding: {
                  dataset: 'earthquakes',
                  geometryColumn: '__sqlrooms_geom',
                },
              },
            ],
          },
          datasets: {earthquakes: {source: {tableName: 'earthquakes'}}},
        },
      },
    );
    expect(result).toMatchObject({success: true, data: {mapId: 'map-1'}});
    expect((result as any).data).not.toHaveProperty('panelId');
    expect(mapsById['map-1'].title).toBe('Earthquake Explorer');
    expect(mapsById['map-1'].config.spec.layers).toHaveLength(1);
    expect(Object.keys(mapsById['map-1'].config.datasets)).toEqual([
      'earthquakes',
    ]);
    expect(mapsById['map-1'].config.datasets.earthquakes).toMatchObject({
      geometryColumn: '__sqlrooms_geom',
      geometryEncodingHint: 'wkb',
      source: {
        tableName: '"main"."earthquakes"',
        transformSql: expect.stringContaining('ST_AsWKB'),
      },
    });
    expect(mapsById['map-1'].config.fitToData).toMatchObject({
      dataset: 'earthquakes',
      geometryColumn: '__sqlrooms_geom',
    });
    expect(state.mosaicDashboard.ensureDashboard).not.toHaveBeenCalled();
    expect(
      invokeCommand.mock.calls.some(([id]) =>
        String(id).startsWith('dashboard.'),
      ),
    ).toBe(false);
  });

  it('keeps actual dashboard block creation on Mosaic commands', async () => {
    const {state, invokeCommand} = setup();
    await command('document.add-dashboard-block').execute(
      {getState: () => state} as any,
      {
        blockDocumentId: 'document-1',
        title: 'Dashboard',
        tableName: 'earthquakes',
      },
    );
    expect(invokeCommand).toHaveBeenCalledWith(
      'dashboard.set-selected-table',
      expect.anything(),
      expect.anything(),
    );
  });
});
