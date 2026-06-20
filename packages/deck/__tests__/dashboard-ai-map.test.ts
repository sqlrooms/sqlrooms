import {
  MAP_TOOL_KEY,
  type DashboardAiAdapter,
  type DatabaseAiAdapter,
} from '@sqlrooms/mosaic';
import {
  createDashboardWithDeckMapAiTools,
  createDeckMapConfigTool,
  createDeckMapDashboardAiTools,
  createDeckMapDashboardTool,
  getDashboardWithDeckMapAiInstructions,
} from '../src/ai';
import {createDeckMapBoundsQuery} from '../src/dashboard';
import {createDeckMapDashboardSliceOptions} from '../src/dashboardIntegration';
import {DECK_MAP_DASHBOARD_PANEL_TYPE} from '../src/dashboardConfig';
import {createDeckMapDashboardPanelConfigForTable} from '../src/mapConfigUtils';
import type {MosaicDashboardEntry} from '@sqlrooms/mosaic';

const scatterConfig = {
  spec: {
    initialViewState: {longitude: 0, latitude: 20, zoom: 1.5},
    layers: [
      {
        '@@type': 'GeoArrowScatterplotLayer',
        id: 'earthquakes-points',
        _sqlroomsBinding: {dataset: 'earthquakes'},
        filled: true,
        pickable: true,
        radiusUnits: 'pixels',
        getRadius: 4,
        getFillColor: [56, 189, 248, 180],
      },
    ],
  },
  datasets: {
    earthquakes: {
      source: {tableName: 'earthquakes'},
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkb',
    },
  },
  fitToData: {
    dataset: 'earthquakes',
    longitudeColumn: 'longitude',
    latitudeColumn: 'latitude',
  },
};

const normalizedScatterConfig = {
  spec: scatterConfig.spec,
  datasets: {
    earthquakes: {
      source: {
        sqlQuery:
          'SELECT *, ST_AsWKB(ST_Point("longitude", "latitude")) AS "geom" FROM "earthquakes" WHERE "longitude" IS NOT NULL AND "latitude" IS NOT NULL',
      },
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkb',
    },
  },
  fitToData: scatterConfig.fitToData,
};

const multiLayerConfig = {
  spec: {
    layers: [
      {
        '@@type': 'GeoArrowScatterplotLayer',
        id: 'earthquakes-points',
        _sqlroomsBinding: {dataset: 'earthquakes'},
        getRadius: 4,
      },
      {
        '@@type': 'GeoArrowHeatmapLayer',
        id: 'earthquakes-density',
        _sqlroomsBinding: {dataset: 'earthquakes'},
        getWeight: 'magnitude',
      },
    ],
  },
  datasets: {
    earthquakes: {
      source: {
        sqlQuery:
          'SELECT *, ST_AsWKB(ST_Point(longitude, latitude)) AS geom FROM earthquakes',
      },
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkb',
    },
  },
};

type TestDashboard = MosaicDashboardEntry & {
  panels: any[];
};

function createTestAdapters() {
  const dashboards: Record<string, TestDashboard> = {
    'dashboard-1': {
      id: 'dashboard-1',
      title: 'Dashboard',
      layoutType: 'grid',
      selectedTable: undefined,
      panels: [],
      layout: null,
      updatedAt: 0,
    },
  };

  const tables: any[] = [
    {
      table: {
        database: 'main',
        schema: 'main',
        table: 'earthquakes',
        toString: () => 'earthquakes',
        toArray: () => ['main', 'earthquakes'],
      } as any,
      tableName: 'earthquakes',
      schema: 'main',
      isView: false,
      rowCount: 1000,
      columns: [
        {name: 'id', type: 'INTEGER'},
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'latitude', type: 'DOUBLE'},
        {name: 'magnitude', type: 'DOUBLE'},
      ],
    },
  ];

  const databaseAdapter: DatabaseAiAdapter = {
    getTables: () => tables,
    findTable: (tableName) => {
      const nameStr =
        typeof tableName === 'string' ? tableName : tableName.toString();
      return tables.find(
        (t) =>
          t.tableName === nameStr ||
          t.table.table === nameStr ||
          t.table.toString() === nameStr,
      );
    },
  };

  const dashboardAdapter: DashboardAiAdapter = {
    setSelectedTable: (tableName) => {
      dashboards['dashboard-1']!.selectedTable = tableName;
    },
    addPanel: (panel) => {
      const dashboard = dashboards['dashboard-1']!;
      const panelId = `panel-${dashboard.panels.length + 1}`;
      dashboard.panels.push({...panel, id: panelId});
      return panelId;
    },
    updatePanel: (panelId, patch) => {
      const panel = dashboards['dashboard-1']!.panels.find(
        (p) => p.id === panelId,
      );
      if (panel) Object.assign(panel, patch);
    },
    removePanel: (panelId) => {
      const dashboard = dashboards['dashboard-1']!;
      dashboard.panels = dashboard.panels.filter((p) => p.id !== panelId);
    },
    getPanel: (panelId) =>
      dashboards['dashboard-1']!.panels.find((p) => p.id === panelId),
    getPanelIssue: () => undefined,
  };

  return {dashboards, databaseAdapter, dashboardAdapter};
}

describe('createDeckMapBoundsQuery', () => {
  it('builds fit-to-data bounds queries from table names', () => {
    const query = createDeckMapBoundsQuery({
      source: {
        tableName: 'events',
      },
      fitToData: {
        dataset: 'events',
        longitudeColumn: 'longitude',
        latitudeColumn: 'latitude',
      },
    });

    expect(query).toContain('SELECT * FROM "events"');
    expect(query).toContain('"longitude"');
    expect(query).toContain('"latitude"');
  });
});

describe('createDeckMapConfigTool', () => {
  it('accepts and returns a native scatterplot Deck JSON map config', async () => {
    const tool = createDeckMapConfigTool();

    const result = await (tool as any).execute({
      title: 'Standalone earthquake map',
      config: scatterConfig,
      reasoning: 'show locations outside a dashboard',
    });

    expect(result.llmResult.success).toBe(true);
    expect(result.llmResult.data).toEqual({
      kind: 'deck-map-config',
      type: DECK_MAP_DASHBOARD_PANEL_TYPE,
      title: 'Standalone earthquake map',
      config: normalizedScatterConfig,
    });
  });

  it('accepts multiple native Deck JSON layers', async () => {
    const tool = createDeckMapConfigTool();

    const result = await (tool as any).execute({
      title: 'Earthquake point and density map',
      config: multiLayerConfig,
      reasoning: 'show points and density',
    });

    expect(result.llmResult.success).toBe(true);
    expect(result.llmResult.data.config.spec.layers).toEqual(
      multiLayerConfig.spec.layers,
    );
  });
});

describe('createDeckMapDashboardTool', () => {
  it('registers the dashboard map tool under the shared map tool key', () => {
    const {dashboardAdapter, databaseAdapter} = createTestAdapters();
    const tools = createDeckMapDashboardAiTools({
      dashboardAdapter,
      databaseAdapter,
    });

    expect(tools[MAP_TOOL_KEY]).toBeDefined();
  });

  it('composes reusable dashboard tools with the deck map dashboard tool', () => {
    const tools = createDashboardWithDeckMapAiTools({
      databaseAdapter: {
        getTables: () => [],
        findTable: () => undefined,
      },
      dashboardAdapter: {
        setSelectedTable: () => {},
        addPanel: () => 'panel-1',
        updatePanel: () => {},
        removePanel: () => {},
        getPanel: () => undefined,
        getPanelIssue: () => undefined,
      },
    });

    expect(tools[MAP_TOOL_KEY]).toBeDefined();
    // Check that chart tools are also present
    expect(Object.keys(tools).length).toBeGreaterThan(1);
  });

  it('includes deck map guidance in reusable dashboard instructions', () => {
    expect(getDashboardWithDeckMapAiInstructions()).toContain(
      'create_dashboard_map',
    );
  });

  it('provides default dashboard slice options with the deck map panel action', () => {
    const options = createDeckMapDashboardSliceOptions();

    expect(
      options.panelRenderers?.[DECK_MAP_DASHBOARD_PANEL_TYPE],
    ).toBeDefined();
    expect(options.addPanelActions).toContainEqual(
      expect.objectContaining({
        type: DECK_MAP_DASHBOARD_PANEL_TYPE,
      }),
    );
    expect(options.chartTypes?.length).toBeGreaterThan(0);
  });

  it('creates a deck map panel from a native Deck JSON config', async () => {
    const {dashboards, dashboardAdapter, databaseAdapter} =
      createTestAdapters();
    const tool = createDeckMapDashboardTool({
      dashboardAdapter,
      databaseAdapter,
    });

    const result = await (tool as any).execute({
      title: 'Earthquake map',
      config: scatterConfig,
      reasoning: 'show locations',
    });

    expect(result.llmResult.success).toBe(true);
    expect(dashboards['dashboard-1']!.selectedTable).toBe('earthquakes');
    expect(dashboards['dashboard-1']!.panels).toHaveLength(1);
    expect(dashboards['dashboard-1']!.panels[0]).toMatchObject({
      type: DECK_MAP_DASHBOARD_PANEL_TYPE,
      title: 'Earthquake map',
      config: normalizedScatterConfig,
    });
  });

  it('updates an existing map panel from a native Deck JSON config', async () => {
    const {dashboards, dashboardAdapter, databaseAdapter} =
      createTestAdapters();
    const tool = createDeckMapDashboardTool({
      dashboardAdapter,
      databaseAdapter,
    });
    const createResult = await (tool as any).execute({
      title: 'Original map',
      config: scatterConfig,
      reasoning: 'show locations',
    });
    const panelId = createResult.llmResult.data.panelId;

    const updateResult = await (tool as any).execute({
      panelId,
      title: 'Updated map',
      config: multiLayerConfig,
      reasoning: 'add density layer',
    });

    expect(updateResult.llmResult.success).toBe(true);
    expect(dashboards['dashboard-1']!.panels).toHaveLength(1);
    expect(dashboards['dashboard-1']!.panels[0]).toMatchObject({
      title: 'Updated map',
      config: multiLayerConfig,
    });
  });

  it('keeps the manual table helper as a lon/lat convenience path', () => {
    const panel = createDeckMapDashboardPanelConfigForTable({
      title: 'Earthquake map',
      tableName: 'earthquakes',
      columns: [
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'latitude', type: 'DOUBLE'},
      ],
    });

    expect(panel.config).toMatchObject({
      datasets: {
        earthquakes: {
          geometryColumn: '__sqlrooms_geom',
          geometryEncodingHint: 'wkb',
        },
      },
      fitToData: {
        dataset: 'earthquakes',
        longitudeColumn: 'longitude',
        latitudeColumn: 'latitude',
      },
    });
    expect(panel.config.datasets.earthquakes.source.sqlQuery).toContain(
      'ST_Point("longitude", "latitude")',
    );
  });

  it('strips trailing semicolons from wrapped manual source SQL queries', () => {
    const panel = createDeckMapDashboardPanelConfigForTable({
      title: 'Earthquake map',
      tableName: 'earthquakes',
      columns: [
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'latitude', type: 'DOUBLE'},
      ],
      sourceSqlQuery: ' SELECT * FROM earthquakes; ;  ',
    });

    expect(panel.config.datasets.earthquakes.source.sqlQuery).toContain(
      'FROM (SELECT * FROM earthquakes) AS "__sqlrooms_dashboard_map_source"',
    );
  });

  it('falls back to table reference when cleaned manual source SQL is empty', () => {
    const panel = createDeckMapDashboardPanelConfigForTable({
      title: 'Earthquake map',
      tableName: 'earthquakes',
      columns: [
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'latitude', type: 'DOUBLE'},
      ],
      sourceSqlQuery: ' ; ',
    });

    expect(panel.config.datasets.earthquakes.source.sqlQuery).toContain(
      'FROM "earthquakes"',
    );
  });

  it('creates a geometry-backed map config when a geometry column is available', () => {
    const panel = createDeckMapDashboardPanelConfigForTable({
      title: 'Store polygons',
      tableName: 'stores',
      columns: [
        {name: 'store_id', type: 'INTEGER'},
        {name: 'geometry', type: 'GEOMETRY'},
      ],
    });

    expect(panel.config).toMatchObject({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowPolygonLayer',
            _sqlroomsBinding: {dataset: 'stores'},
          },
        ],
      },
      datasets: {
        stores: {
          source: {tableName: 'stores'},
          geometryColumn: 'geometry',
        },
      },
    });
    expect(panel.config.fitToData).toBeUndefined();
  });
});
