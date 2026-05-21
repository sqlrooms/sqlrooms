import type {DashboardToolDeps} from '@sqlrooms/mosaic';
import {createDeckMapConfigTool, createDeckMapDashboardTool} from '../src/ai';
import {DECK_MAP_DASHBOARD_PANEL_TYPE} from '../src/dashboardConfig';

function createDeps(): DashboardToolDeps & {
  panels: any[];
  selectedTables: string[];
  currentArtifacts: string[];
} {
  const panels: any[] = [];
  const selectedTables: string[] = [];
  const currentArtifacts: string[] = [];

  return {
    panels,
    selectedTables,
    currentArtifacts,
    maxDataPoints: 10_000,
    resolveArtifact: () => 'dashboard-1',
    resolveTable: (_artifactId, tableName) => {
      selectedTables.push(tableName ?? 'earthquakes');
      return {
        tableName: tableName ?? 'earthquakes',
        columns: [
          {name: 'id', type: 'INTEGER'},
          {name: 'longitude', type: 'DOUBLE'},
          {name: 'latitude', type: 'DOUBLE'},
          {name: 'magnitude', type: 'DOUBLE'},
        ],
      };
    },
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
  it('creates a deck map config without dashboard dependencies', async () => {
    const tool = createDeckMapConfigTool();

    const result = await (tool as any).execute({
      tableName: 'earthquakes',
      title: 'Standalone earthquake map',
      columns: [
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'latitude', type: 'DOUBLE'},
      ],
      reasoning: 'show locations outside a dashboard',
    });

    expect(result.llmResult.success).toBe(true);
    expect(result.llmResult.data).toMatchObject({
      kind: 'deck-map-config',
      type: DECK_MAP_DASHBOARD_PANEL_TYPE,
      title: 'Standalone earthquake map',
      config: {
        datasets: {
          earthquakes: {
            geometryColumn: '__sqlrooms_geom',
            geometryEncodingHint: 'wkb',
          },
        },
      },
    });
    expect(
      result.llmResult.data.config.datasets.earthquakes.source.sqlQuery,
    ).toContain('ST_Point("longitude", "latitude")');
  });
});

describe('createDeckMapDashboardTool', () => {
  it('creates a deck map panel from inferred longitude and latitude columns', async () => {
    const deps = createDeps();
    const tool = createDeckMapDashboardTool(deps);

    const result = await (tool as any).execute({
      tableName: 'earthquakes',
      title: 'Earthquake map',
      reasoning: 'show locations',
    });

    expect(result.llmResult.success).toBe(true);
    expect(deps.panels).toHaveLength(1);
    expect(deps.panels[0]).toMatchObject({
      type: DECK_MAP_DASHBOARD_PANEL_TYPE,
      title: 'Earthquake map',
      config: {
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
      },
    });
    expect(
      deps.panels[0].config.datasets.earthquakes.source.sqlQuery,
    ).toContain('ST_Point("longitude", "latitude")');
    expect(deps.currentArtifacts).toEqual(['dashboard-1']);
  });

  it('updates an existing map panel', async () => {
    const deps = createDeps();
    const tool = createDeckMapDashboardTool(deps);
    const createResult = await (tool as any).execute({
      tableName: 'earthquakes',
      title: 'Original map',
      reasoning: 'show locations',
    });
    const panelId = createResult.llmResult.data.panelId;

    const updateResult = await (tool as any).execute({
      tableName: 'earthquakes',
      panelId,
      title: 'Updated map',
      pointRadius: 8,
      reasoning: 'make points larger',
    });

    expect(updateResult.llmResult.success).toBe(true);
    expect(deps.panels).toHaveLength(1);
    expect(deps.panels[0].title).toBe('Updated map');
    expect(deps.panels[0].config.spec.layers[0].getRadius).toBe(8);
  });

  it('returns a useful error when no coordinates or geometry are available', async () => {
    const deps = createDeps();
    deps.resolveTable = () => ({
      tableName: 'places',
      columns: [{name: 'name', type: 'VARCHAR'}],
    });
    const tool = createDeckMapDashboardTool(deps);

    const result = await (tool as any).execute({
      tableName: 'places',
      reasoning: 'show locations',
    });

    expect(result.llmResult.success).toBe(false);
    expect(result.llmResult.errorMessage).toContain(
      'Could not find longitude/latitude columns',
    );
  });
});
