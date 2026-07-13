import {describe, expect, jest, test} from '@jest/globals';
import {
  createOrUpdateDeckMapResource,
  type CreateOrUpdateDeckMapResourceHost,
} from '../src/createOrUpdateDeckMapResource';
import type {DeckMapConfig} from '../src/mapConfig';

const config: DeckMapConfig = {
  spec: {
    layers: [
      {
        '@@type': 'GeoArrowScatterplotLayer',
        _sqlroomsBinding: {dataset: 'places'},
      },
    ],
  },
  datasets: {places: {source: {tableName: 'places'}}},
};

function host(overrides: Partial<CreateOrUpdateDeckMapResourceHost> = {}) {
  const value: CreateOrUpdateDeckMapResourceHost = {
    ensureBlockDocument: jest.fn(),
    findMapBlock: jest.fn(() => undefined),
    findMap: jest.fn(() => undefined),
    createMapBlock: jest.fn(async ({mapId}) => ({blockId: 'block-1', mapId})),
    updateBlockMetadata: jest.fn(),
    ensureMap: jest.fn(),
    writeMap: jest.fn(),
    findTable: jest.fn(() => ({tableIdentity: 'main.places'})),
    ...overrides,
  };
  return value;
}

describe('createOrUpdateDeckMapResource', () => {
  test('rejects a non-resource dataset config before creating durable state', async () => {
    const h = host();
    const invalidConfig = {
      configMode: 'custom',
      datasets: {
        coffee_shops: {
          geometryColumn: 'geom',
          sql: 'SELECT name, geom FROM coffee_shops_nyc',
        },
      },
      spec: {
        layers: [
          {
            '@@type': 'GeoJsonLayer',
            data: '@@#coffee_shops',
          },
        ],
      },
    } as unknown as DeckMapConfig;

    await expect(
      createOrUpdateDeckMapResource(h, {
        blockDocumentId: 'worksheet-1',
        config: invalidConfig,
        tableName: 'coffee_shops_nyc',
        createMapId: () => 'map-1',
      }),
    ).rejects.toThrow(
      'datasets.coffee_shops.source: must define source.tableName or source.sqlQuery; top-level sql is not supported',
    );
    expect(h.createMapBlock).not.toHaveBeenCalled();
    expect(h.ensureMap).not.toHaveBeenCalled();
    expect(h.writeMap).not.toHaveBeenCalled();
  });

  test('creates a durable map and returns no panel identity', async () => {
    const h = host();
    const result = await createOrUpdateDeckMapResource(h, {
      blockDocumentId: 'worksheet-1',
      config,
      title: 'Places',
      createMapId: () => 'map-1',
    });
    expect(result).toMatchObject({
      mapId: 'map-1',
      blockId: 'block-1',
      created: true,
    });
    expect(result).not.toHaveProperty('panelId');
    expect(h.writeMap).toHaveBeenCalledWith({
      mapId: 'map-1',
      title: 'Places',
      config,
      selectedTable: 'main.places',
    });
  });

  test('uses a requested map id when create mode recovers a missing block', async () => {
    const h = host();
    const createMapId = jest.fn(() => 'generated-map');

    const result = await createOrUpdateDeckMapResource(h, {
      blockDocumentId: 'worksheet-1',
      config,
      mapId: 'requested-map',
      missingMapBlockBehavior: 'create',
      createMapId,
    });

    expect(result.mapId).toBe('requested-map');
    expect(h.createMapBlock).toHaveBeenCalledWith(
      expect.objectContaining({mapId: 'requested-map'}),
    );
    expect(createMapId).not.toHaveBeenCalled();
  });

  test('generates a map id in create mode when none is requested', async () => {
    const h = host();

    const result = await createOrUpdateDeckMapResource(h, {
      blockDocumentId: 'worksheet-1',
      config,
      missingMapBlockBehavior: 'create',
      createMapId: () => 'generated-map',
    });

    expect(result.mapId).toBe('generated-map');
  });

  test('preserves a meaningful caption before the resource title', async () => {
    const h = host({
      findMapBlock: jest.fn(() => ({
        blockId: 'block-1',
        mapId: 'map-1',
        caption: 'Saved caption',
      })),
      findMap: jest.fn(() => ({id: 'map-1', title: 'Saved title', config})),
    });
    await createOrUpdateDeckMapResource(h, {
      blockDocumentId: 'worksheet-1',
      mapId: 'map-1',
      config,
    });
    expect(h.writeMap).toHaveBeenCalledWith(
      expect.objectContaining({title: 'Saved caption'}),
    );
  });

  test('ignores a blank saved caption when preserving the resource title', async () => {
    const h = host({
      findMapBlock: jest.fn(() => ({
        blockId: 'block-1',
        mapId: 'map-1',
        caption: '   ',
      })),
      findMap: jest.fn(() => ({id: 'map-1', title: 'Saved title', config})),
    });

    await createOrUpdateDeckMapResource(h, {
      blockDocumentId: 'worksheet-1',
      mapId: 'map-1',
      config,
    });

    expect(h.writeMap).toHaveBeenCalledWith(
      expect.objectContaining({title: 'Saved title'}),
    );
    expect(h.updateBlockMetadata).toHaveBeenCalledWith(
      expect.objectContaining({caption: 'Saved title'}),
    );
  });

  test('updates metadata only after the map write succeeds', async () => {
    const order: string[] = [];
    const h = host({
      findMapBlock: jest.fn(() => ({
        blockId: 'block-1',
        mapId: 'map-1',
        caption: 'Old',
      })),
      findMap: jest.fn(() => ({id: 'map-1', title: 'Old', config})),
      writeMap: jest.fn(async () => {
        order.push('map');
      }),
      updateBlockMetadata: jest.fn(async () => {
        order.push('metadata');
      }),
    });
    await createOrUpdateDeckMapResource(h, {
      blockDocumentId: 'worksheet-1',
      mapId: 'map-1',
      title: 'New',
      config,
    });
    expect(order).toEqual(['map', 'metadata']);
  });

  test('does not update metadata after a failed map write', async () => {
    const updateBlockMetadata = jest.fn();
    const h = host({
      findMapBlock: jest.fn(() => ({blockId: 'block-1', mapId: 'map-1'})),
      findMap: jest.fn(() => ({id: 'map-1', title: 'Old', config})),
      writeMap: jest.fn(async () => {
        throw new Error('write failed');
      }),
      updateBlockMetadata,
    });
    await expect(
      createOrUpdateDeckMapResource(h, {
        blockDocumentId: 'worksheet-1',
        mapId: 'map-1',
        title: 'New',
        config,
      }),
    ).rejects.toThrow('write failed');
    expect(updateBlockMetadata).not.toHaveBeenCalled();
  });
});
