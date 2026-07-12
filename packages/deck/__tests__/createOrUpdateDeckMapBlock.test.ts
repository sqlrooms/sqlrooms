import {jest} from '@jest/globals';
import {
  createOrUpdateDeckMapBlock,
  type CreateOrUpdateDeckMapBlockHost,
} from '../src/createOrUpdateDeckMapBlock';
import type {DeckMapDashboardConfigToolConfig} from '../src/ai';

function createHost(
  overrides: Partial<CreateOrUpdateDeckMapBlockHost> = {},
): CreateOrUpdateDeckMapBlockHost & {
  panels: Map<string, {id: string; title?: string; config?: unknown}>;
  blocks: Map<string, {blockId: string; mapId: string; caption?: string}>;
} {
  const panels = new Map<
    string,
    {id: string; title?: string; config?: unknown}
  >();
  const blocks = new Map<
    string,
    {blockId: string; mapId: string; caption?: string}
  >();

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
        title: panel.title,
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

  it('preserves the existing caption as the title on title-less updates', async () => {
    const ensureDashboard = jest.fn();
    const ensureMapState = jest.fn();
    const updateBlockMetadata = jest.fn(async () => {});
    const host = createHost({
      ensureDashboard,
      ensureMapState,
      updateBlockMetadata,
    });
    host.blocks.set('map-1', {
      blockId: 'block-map-1',
      mapId: 'map-1',
      caption: 'Sales by region',
    });
    host.panels.set('map-1', {
      id: 'panel-1',
      title: 'Panel Title',
      config: {},
    });

    const result = await createOrUpdateDeckMapBlock(host, {
      blockDocumentId: 'doc-1',
      mapId: 'map-1',
      config: basicConfig,
      // no title / caption — Ask AI edit path
    });

    expect(result).toMatchObject({
      created: false,
      message: 'Updated block document map block "Sales by region".',
    });
    expect(ensureMapState).toHaveBeenCalledWith('map-1', 'Sales by region');
    expect(ensureDashboard).toHaveBeenCalledWith('map-1', 'Sales by region');
    expect(updateBlockMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'block-map-1',
        caption: 'Sales by region',
      }),
    );
  });

  it('preserves the panel title when a title-less update has an empty block caption', async () => {
    const ensureDashboard = jest.fn();
    const ensureMapState = jest.fn();
    const updateBlockMetadata = jest.fn(async () => {});
    const host = createHost({
      ensureDashboard,
      ensureMapState,
      updateBlockMetadata,
    });
    host.blocks.set('map-1', {
      blockId: 'block-map-1',
      mapId: 'map-1',
      caption: '',
    });
    host.panels.set('map-1', {
      id: 'panel-1',
      title: 'Earthquakes map',
      config: {},
    });

    const result = await createOrUpdateDeckMapBlock(host, {
      blockDocumentId: 'doc-1',
      mapId: 'map-1',
      config: basicConfig,
    });

    expect(result.message).toBe(
      'Updated block document map block "Earthquakes map".',
    );
    expect(ensureMapState).toHaveBeenCalledWith('map-1', 'Earthquakes map');
    expect(ensureDashboard).toHaveBeenCalledWith('map-1', 'Earthquakes map');
    expect(updateBlockMetadata).toHaveBeenCalledWith(
      expect.objectContaining({caption: 'Earthquakes map'}),
    );
    expect(host.panels.get('map-1')?.title).toBe('Earthquakes map');
  });

  it('does not persist metadata when an existing panel update fails', async () => {
    const updateBlockMetadata = jest.fn(async () => {});
    const addOrUpdateMapPanel = jest.fn(async () => {
      throw new Error('panel update failed');
    });
    const host = createHost({updateBlockMetadata, addOrUpdateMapPanel});
    host.blocks.set('map-1', {
      blockId: 'block-map-1',
      mapId: 'map-1',
      caption: 'Original title',
    });
    host.panels.set('map-1', {
      id: 'panel-1',
      title: 'Original title',
      config: {},
    });

    await expect(
      createOrUpdateDeckMapBlock(host, {
        blockDocumentId: 'doc-1',
        mapId: 'map-1',
        config: basicConfig,
        title: 'New title',
        height: 720,
      }),
    ).rejects.toThrow('panel update failed');

    expect(updateBlockMetadata).not.toHaveBeenCalled();
  });

  it('uses an explicit caption as the title on update', async () => {
    const ensureDashboard = jest.fn();
    const ensureMapState = jest.fn();
    const updateBlockMetadata = jest.fn(async () => {});
    const host = createHost({
      ensureDashboard,
      ensureMapState,
      updateBlockMetadata,
    });
    host.blocks.set('map-1', {
      blockId: 'block-map-1',
      mapId: 'map-1',
      caption: 'Old caption',
    });

    await createOrUpdateDeckMapBlock(host, {
      blockDocumentId: 'doc-1',
      mapId: 'map-1',
      config: basicConfig,
      caption: 'New caption',
    });

    expect(ensureMapState).toHaveBeenCalledWith('map-1', 'New caption');
    expect(ensureDashboard).toHaveBeenCalledWith('map-1', 'New caption');
    expect(updateBlockMetadata).toHaveBeenCalledWith(
      expect.objectContaining({caption: 'New caption'}),
    );
  });

  it('uses the Map caption and title defaults when creating', async () => {
    const ensureDashboard = jest.fn();
    const ensureMapState = jest.fn();
    const createMapBlock = jest.fn(
      async (
        options: Parameters<
          CreateOrUpdateDeckMapBlockHost['createMapBlock']
        >[0],
      ) => ({
        blockId: `block-${options.mapId}`,
        mapId: options.mapId,
      }),
    );
    const host = createHost({
      createMapBlock,
      ensureDashboard,
      ensureMapState,
    });

    await createOrUpdateDeckMapBlock(host, {
      blockDocumentId: 'doc-1',
      config: basicConfig,
      createMapId: () => 'map-1',
    });

    expect(createMapBlock).toHaveBeenCalledWith(
      expect.objectContaining({title: 'Map', caption: 'Map'}),
    );
    expect(ensureMapState).toHaveBeenCalledWith('map-1', 'Map');
    expect(ensureDashboard).toHaveBeenCalledWith('map-1', 'Map');
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

  it('creates a panel for a stale panelId when missingPanelBehavior is create', async () => {
    const host = createHost();
    host.blocks.set('map-1', {blockId: 'block-map-1', mapId: 'map-1'});
    host.panels.set('map-1', {id: 'panel-1', config: {}});

    const result = await createOrUpdateDeckMapBlock(host, {
      blockDocumentId: 'doc-1',
      mapId: 'map-1',
      panelId: 'stale-panel',
      config: basicConfig,
      title: 'Places',
      missingPanelBehavior: 'create',
    });

    expect(result.created).toBe(false);
    expect(result.panelId).toBeTruthy();
    expect(result.panelId).not.toBe('stale-panel');
  });

  it('throws on a stale panelId when missingPanelBehavior is throw', async () => {
    const host = createHost();
    host.blocks.set('map-1', {blockId: 'block-map-1', mapId: 'map-1'});
    host.panels.set('map-1', {id: 'panel-1', config: {}});

    await expect(
      createOrUpdateDeckMapBlock(host, {
        blockDocumentId: 'doc-1',
        mapId: 'map-1',
        panelId: 'stale-panel',
        config: basicConfig,
        missingPanelBehavior: 'throw',
      }),
    ).rejects.toThrow(/Map panel stale-panel was not found/);
  });
});
