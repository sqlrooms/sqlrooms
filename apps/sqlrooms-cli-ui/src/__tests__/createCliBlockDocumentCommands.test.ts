import {jest} from '@jest/globals';
import {makeQualifiedTableName} from '@sqlrooms/duckdb';
import {createCliBlockDocumentCommands} from '../createCliBlockDocumentCommands';

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
              _sqlroomsBinding: {dataset: 'earthquakes'},
            },
          ],
        },
        datasets: {
          earthquakes: {source: {tableName: 'earthquakes'}},
        },
      },
    },
  };
  const invokeCommand = jest.fn(async (id: string, input: any) => {
    if (id === 'block-document.create-stateful-block') {
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
        id: 'worksheet-1',
        type: 'worksheet',
        title: 'Worksheet',
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
  it('updates worksheet maps as resources without dashboard commands or panelId', async () => {
    const {state, invokeCommand, mapsById} = setup();
    const result = await command('block-document.add-map-block').execute(
      {getState: () => state} as any,
      {
        blockDocumentId: 'worksheet-1',
        mapId: 'map-1',
        reasoning: 'change colors',
        replaceLayers: true,
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
    expect(mapsById['map-1'].config.datasets.earthquakes).toMatchObject({
      geometryColumn: '__sqlrooms_geom',
      geometryEncodingHint: 'wkb',
      source: {
        tableName: 'earthquakes',
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
    await command('block-document.add-dashboard-block').execute(
      {getState: () => state} as any,
      {
        blockDocumentId: 'worksheet-1',
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
