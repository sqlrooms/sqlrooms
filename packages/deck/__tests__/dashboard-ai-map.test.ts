import type {DashboardToolDeps} from '@sqlrooms/mosaic';
import {MAP_TOOL_KEY} from '@sqlrooms/mosaic/ai';
import {
  createDeckMapConfigTool,
  createDeckMapDashboardAiTools,
  createDeckMapDashboardTool,
} from '../src/ai';
import {DECK_MAP_DASHBOARD_PANEL_TYPE} from '../src/dashboardConfig';
import {createDeckMapDashboardPanelConfigForTable} from '../src/mapConfigUtils';

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

function createDeps(): DashboardToolDeps & {
  panels: any[];
  currentArtifacts: string[];
} {
  const panels: any[] = [];
  const currentArtifacts: string[] = [];

  return {
    panels,
    currentArtifacts,
    maxDataPoints: 10_000,
    resolveArtifact: () => 'dashboard-1',
    resolveTable: () => ({
      tableName: 'earthquakes',
      columns: [
        {name: 'id', type: 'INTEGER'},
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'latitude', type: 'DOUBLE'},
        {name: 'magnitude', type: 'DOUBLE'},
      ],
    }),
    addPanel: (_dashboardId, panel) => {
      panels.push(panel);
      return panel.id;
    },
    updatePanel: (_dashboardId, panelId, patch) => {
      const panel = panels.find((candidate) => candidate.id === panelId);
      if (panel) Object.assign(panel, patch);
    },
    getDashboard: (dashboardId) =>
      ({
        id: dashboardId,
        title: 'Dashboard',
        layoutType: 'grid',
        panels,
        layout: null,
        updatedAt: 0,
      }) as any,
    removePanel: (_dashboardId, panelId) => {
      const index = panels.findIndex((candidate) => candidate.id === panelId);
      if (index >= 0) panels.splice(index, 1);
    },
    setCurrentArtifact: (artifactId) => {
      currentArtifacts.push(artifactId);
    },
  };
}

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
      config: scatterConfig,
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
    const tools = createDeckMapDashboardAiTools(createDeps());

    expect(tools[MAP_TOOL_KEY]).toBeDefined();
  });

  it('creates a deck map panel from a native Deck JSON config', async () => {
    const deps = createDeps();
    const tool = createDeckMapDashboardTool(deps);

    const result = await (tool as any).execute({
      title: 'Earthquake map',
      config: scatterConfig,
      reasoning: 'show locations',
    });

    expect(result.llmResult.success).toBe(true);
    expect(deps.panels).toHaveLength(1);
    expect(deps.panels[0]).toMatchObject({
      type: DECK_MAP_DASHBOARD_PANEL_TYPE,
      title: 'Earthquake map',
      config: scatterConfig,
    });
    expect(deps.currentArtifacts).toEqual(['dashboard-1']);
  });

  it('updates an existing map panel from a native Deck JSON config', async () => {
    const deps = createDeps();
    const tool = createDeckMapDashboardTool(deps);
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
    expect(deps.panels).toHaveLength(1);
    expect(deps.panels[0]).toMatchObject({
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
});
