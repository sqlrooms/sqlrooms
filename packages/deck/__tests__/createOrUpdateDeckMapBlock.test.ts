import {
  createOrUpdateDeckMapBlock,
  type CreateOrUpdateDeckMapBlockHost,
} from '../src/createOrUpdateDeckMapBlock';
import type {DeckMapDashboardConfigToolConfig} from '../src/ai';

function createHost(
  overrides: Partial<CreateOrUpdateDeckMapBlockHost> = {},
): CreateOrUpdateDeckMapBlockHost & {
  panels: Map<string, {id: string; config?: unknown}>;
  blocks: Map<string, {blockId: string; mapId: string}>;
} {
  const panels = new Map<string, {id: string; config?: unknown}>();
  const blocks = new Map<string, {blockId: string; mapId: string}>();

  return {
    panels,
    blocks,
    ensureBlockDocument: () => {},
    findMapBlock: (_docId, mapId) => blocks.get(mapId),
    findMapPanel: (mapId, panelId) => {
      const panel = panels.get(mapId);
      if (!panel) return undefined;
      if (panelId && panel.id !== panelId) return undefined;
      return panel;
    },
    createMapBlock: async ({mapId}) => {
      const created = {blockId: `block-${mapId}`, mapId};
      blocks.set(mapId, created);
      return created;
    },
    updateBlockMetadata: async () => {},
    ensureMapState: () => {},
    ensureDashboard: () => {},
    setSelectedTable: async () => {},
    addOrUpdateMapPanel: async ({mapId, panel, existingPanelId}) => {
      panels.set(mapId, {
        id: existingPanelId ?? panel.id,
        config: panel.config,
      });
    },
    findTable: (tableName) =>
      tableName === 'places' ? {tableIdentity: 'main.places'} : undefined,
    ...overrides,
  };
}

const basicConfig = {
  configMode: 'basic',
  spec: {layers: []},
  datasets: {
    places: {source: {tableName: 'places'}},
  },
} as DeckMapDashboardConfigToolConfig;

describe('createOrUpdateDeckMapBlock', () => {
  it('creates a map block when mapId is omitted', async () => {
    const host = createHost();
    const result = await createOrUpdateDeckMapBlock(host, {
      blockDocumentId: 'doc-1',
      config: basicConfig,
      createMapId: () => 'map-1',
      title: 'Places',
    });

    expect(result).toMatchObject({
      blockDocumentId: 'doc-1',
      blockId: 'block-map-1',
      mapId: 'map-1',
      selectedTable: 'main.places',
      created: true,
    });
    expect(host.panels.get('map-1')?.config).toBeTruthy();
  });

  it('updates an existing map block', async () => {
    const host = createHost();
    host.blocks.set('map-1', {blockId: 'block-map-1', mapId: 'map-1'});
    host.panels.set('map-1', {id: 'panel-1', config: {}});

    const result = await createOrUpdateDeckMapBlock(host, {
      blockDocumentId: 'doc-1',
      mapId: 'map-1',
      config: basicConfig,
      title: 'Updated',
    });

    expect(result).toMatchObject({
      blockId: 'block-map-1',
      mapId: 'map-1',
      panelId: 'panel-1',
      created: false,
    });
  });

  it('throws when mapId is missing and behavior is throw', async () => {
    const host = createHost();
    await expect(
      createOrUpdateDeckMapBlock(host, {
        blockDocumentId: 'doc-1',
        mapId: 'missing',
        config: basicConfig,
        missingMapBlockBehavior: 'throw',
      }),
    ).rejects.toThrow(/was not found/);
  });
});
