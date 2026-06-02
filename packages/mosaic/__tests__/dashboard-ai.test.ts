import {
  createDashboardAiTools,
  createDashboardToolDeps,
  DASHBOARD_AGENT_INSTRUCTIONS,
  DASHBOARD_AI_INSTRUCTIONS,
  MAP_TOOL_KEY,
  type DashboardAiAdapter,
  type DashboardAiTable,
} from '../src/ai';
import type {
  MosaicDashboardEntry,
  MosaicDashboardLayoutType,
} from '../src/dashboard/dashboard-types';
import type {ChartRuntimeIssue} from '../src/chart-runtime';

type TestState = {
  artifactsById: Record<string, {id: string; type: string; title: string}>;
  currentArtifactId?: string;
  tables: DashboardAiTable[];
  dashboardsById: Record<string, MosaicDashboardEntry>;
  runtimeIssues: Record<string, ChartRuntimeIssue>;
  setCurrentArtifactCalls: string[];
  nextDashboardId: number;
};

function createDashboardEntry(
  id: string,
  title = 'Dashboard',
  layoutType: MosaicDashboardLayoutType = 'grid',
): MosaicDashboardEntry {
  return {
    id,
    title,
    layoutType,
    selectedTable: undefined,
    panels: [],
    layout: null,
    updatedAt: 0,
  };
}

function createHarness(overrides: Partial<TestState> = {}): {
  store: {getState: () => TestState};
  state: TestState;
  adapter: DashboardAiAdapter<TestState>;
} {
  const state: TestState = {
    artifactsById: {},
    tables: [
      {
        tableName: 'earthquakes',
        rowCount: 10,
        columns: [
          {name: 'magnitude', type: 'DOUBLE'},
          {name: 'region', type: 'VARCHAR'},
        ],
      },
    ],
    dashboardsById: {},
    runtimeIssues: {},
    setCurrentArtifactCalls: [],
    nextDashboardId: 1,
    ...overrides,
  };

  const adapter: DashboardAiAdapter<TestState> = {
    getTables: (current) => current.tables,
    resolveContextDashboardArtifactId: (_current, context) =>
      (context as {dashboardId?: string} | undefined)?.dashboardId,
    getCurrentDashboardArtifactId: (current) => {
      const artifactId = current.currentArtifactId;
      return artifactId &&
        current.artifactsById[artifactId]?.type === 'dashboard'
        ? artifactId
        : undefined;
    },
    createDashboardArtifact: (current, title, layoutType = 'grid') => {
      const artifactId = `dashboard-${current.nextDashboardId++}`;
      current.artifactsById[artifactId] = {
        id: artifactId,
        type: 'dashboard',
        title: title ?? 'Dashboard',
      };
      current.dashboardsById[artifactId] = createDashboardEntry(
        artifactId,
        title ?? 'Dashboard',
        layoutType,
      );
      return artifactId;
    },
    isDashboardArtifact: (current, artifactId) =>
      current.artifactsById[artifactId]?.type === 'dashboard',
    setCurrentArtifact: (current, artifactId) => {
      current.currentArtifactId = artifactId;
      current.setCurrentArtifactCalls.push(artifactId);
    },
    ensureDashboard: (current, dashboardId, title, layoutType = 'grid') => {
      current.dashboardsById[dashboardId] ??= createDashboardEntry(
        dashboardId,
        title,
        layoutType,
      );
    },
    getDashboard: (current, dashboardId) => current.dashboardsById[dashboardId],
    getPanelIssue: (current, dashboardId, panelId) =>
      current.runtimeIssues[`${dashboardId}:${panelId}`],
    setSelectedTable: (current, dashboardId, tableName) => {
      current.dashboardsById[dashboardId]!.selectedTable = tableName;
    },
    addPanel: (current, dashboardId, panel) => {
      current.dashboardsById[dashboardId]!.panels.push(panel);
      return panel.id;
    },
    updatePanel: (current, dashboardId, panelId, patch) => {
      const panel = current.dashboardsById[dashboardId]!.panels.find(
        (candidate) => candidate.id === panelId,
      );
      if (panel) Object.assign(panel, patch);
    },
    removePanel: (current, dashboardId, panelId) => {
      current.dashboardsById[dashboardId]!.panels = current.dashboardsById[
        dashboardId
      ]!.panels.filter((panel) => panel.id !== panelId);
    },
  };

  return {
    state,
    adapter,
    store: {
      getState: () => state,
    },
  };
}

describe('dashboard AI deps', () => {
  it('creates a dashboard when missing and makes it current', () => {
    const {store, adapter, state} = createHarness();
    const deps = createDashboardToolDeps({store, adapter});

    const artifactId = deps.resolveArtifact(undefined, true);

    expect(artifactId).toBe('dashboard-1');
    expect(state.currentArtifactId).toBe(artifactId);
    expect(state.setCurrentArtifactCalls).toEqual([artifactId]);
  });

  it('uses the chart package default max data point limit for AI guidance', () => {
    const {store, adapter} = createHarness();

    const deps = createDashboardToolDeps({store, adapter});

    expect(deps.maxDataPoints).toBe(10_000);
  });

  it('resolves explicit artifact before context and current artifact', () => {
    const explicitId = 'explicit-dashboard';
    const contextId = 'context-dashboard';
    const currentId = 'current-dashboard';
    const {store, adapter, state} = createHarness({
      currentArtifactId: currentId,
      artifactsById: {
        [explicitId]: {id: explicitId, type: 'dashboard', title: 'Explicit'},
        [contextId]: {id: contextId, type: 'dashboard', title: 'Context'},
        [currentId]: {id: currentId, type: 'dashboard', title: 'Current'},
      },
      dashboardsById: {
        [explicitId]: createDashboardEntry(explicitId),
        [contextId]: createDashboardEntry(contextId),
        [currentId]: createDashboardEntry(currentId),
      },
    });
    const deps = createDashboardToolDeps({store, adapter});

    expect(
      deps.resolveArtifact(explicitId, false, {dashboardId: contextId} as any),
    ).toBe(explicitId);
    expect(state.currentArtifactId).toBe(currentId);
  });

  it('resolves explicit, selected, and single-table fallbacks', () => {
    const dashboardId = 'dashboard';
    const {store, adapter, state} = createHarness({
      artifactsById: {
        [dashboardId]: {id: dashboardId, type: 'dashboard', title: 'Dashboard'},
      },
      dashboardsById: {
        [dashboardId]: createDashboardEntry(dashboardId),
      },
    });
    const deps = createDashboardToolDeps({store, adapter});

    expect(deps.resolveTable(dashboardId, 'earthquakes').tableName).toBe(
      'earthquakes',
    );
    expect(state.dashboardsById[dashboardId]!.selectedTable).toBe(
      'earthquakes',
    );

    state.dashboardsById[dashboardId]!.selectedTable = 'earthquakes';
    expect(deps.resolveTable(dashboardId).tableName).toBe('earthquakes');

    state.dashboardsById[dashboardId]!.selectedTable = undefined;
    expect(deps.resolveTable(dashboardId).tableName).toBe('earthquakes');
  });

  it('returns useful errors for unknown tables and non-dashboard artifacts', () => {
    const {store, adapter} = createHarness({
      artifactsById: {
        notDashboard: {id: 'notDashboard', type: 'document', title: 'Doc'},
      },
    });
    const deps = createDashboardToolDeps({store, adapter});

    expect(() => deps.resolveArtifact('notDashboard')).toThrow(
      'is not a dashboard artifact',
    );
    expect(() => deps.resolveTable('missing-dashboard', 'missing')).toThrow(
      'Unknown table "missing"',
    );
  });
});

describe('dashboard AI tools', () => {
  it('includes the shared map tool key in dashboard prompts', () => {
    expect(DASHBOARD_AI_INSTRUCTIONS).toContain(MAP_TOOL_KEY);
    expect(DASHBOARD_AGENT_INSTRUCTIONS).toContain(MAP_TOOL_KEY);
  });

  it('rejects host tools that collide with built-in dashboard tools', () => {
    const {store, adapter} = createHarness();

    expect(() =>
      createDashboardAiTools({
        store,
        adapter,
        extraTools: () => ({
          create_dashboard_artifact: {} as any,
        }),
      }),
    ).toThrow('cannot override built-in tool "create_dashboard_artifact"');
  });

  it('creates and updates chart and Data Table Explorer panels', async () => {
    const {store, adapter, state} = createHarness();
    const tools = createDashboardAiTools({store, adapter});

    const histogramResult = await (
      tools.create_dashboard_histogram as any
    ).execute({
      tableName: 'earthquakes',
      createArtifactIfMissing: true,
      settings: {field: 'magnitude'},
      reasoning: 'test',
    });
    const dashboardId = histogramResult.llmResult.data.artifactId;
    const chartPanelId = histogramResult.llmResult.data.panelId;

    expect(histogramResult.llmResult.success).toBe(true);
    expect(state.currentArtifactId).toBe(dashboardId);
    expect(state.dashboardsById[dashboardId]!.panels).toHaveLength(1);

    const updateResult = await (
      tools.create_dashboard_histogram as any
    ).execute({
      artifactId: dashboardId,
      tableName: 'earthquakes',
      panelId: chartPanelId,
      settings: {field: 'magnitude', maxBins: 30},
      reasoning: 'test',
    });
    expect(updateResult.llmResult.success).toBe(true);
    expect(
      state.dashboardsById[dashboardId]!.panels[0]!.config.settings.maxBins,
    ).toBe(30);

    const dataTableExplorerResult = await (
      tools.create_dashboard_data_table_explorer as any
    ).execute({
      artifactId: dashboardId,
      tableName: 'earthquakes',
      title: 'Explore',
      reasoning: 'test',
    });
    expect(dataTableExplorerResult.llmResult.success).toBe(true);
    expect(state.dashboardsById[dashboardId]!.panels).toHaveLength(2);
  });

  it('fails when updating or removing an unknown panel', async () => {
    const dashboardId = 'dashboard';
    const {store, adapter} = createHarness({
      currentArtifactId: dashboardId,
      artifactsById: {
        [dashboardId]: {id: dashboardId, type: 'dashboard', title: 'Dashboard'},
      },
      dashboardsById: {
        [dashboardId]: createDashboardEntry(dashboardId),
      },
    });
    const tools = createDashboardAiTools({store, adapter});

    const updateResult = await (
      tools.create_dashboard_histogram as any
    ).execute({
      artifactId: dashboardId,
      panelId: 'missing-panel',
      tableName: 'earthquakes',
      settings: {field: 'magnitude'},
      reasoning: 'test',
    });
    const removeResult = await (tools.remove_dashboard_panel as any).execute({
      artifactId: dashboardId,
      panelId: 'missing-panel',
      reasoning: 'test',
    });

    expect(updateResult.llmResult.success).toBe(false);
    expect(updateResult.llmResult.errorMessage).toContain(
      'Panel "missing-panel" not found',
    );
    expect(removeResult.llmResult.success).toBe(false);
    expect(removeResult.llmResult.errorMessage).toContain(
      'Panel "missing-panel" not found',
    );
  });

  it('lists panel runtime issues for AI repair workflows', async () => {
    const dashboardId = 'dashboard';
    const panelId = 'panel-1';
    const {store, adapter} = createHarness({
      currentArtifactId: dashboardId,
      artifactsById: {
        [dashboardId]: {id: dashboardId, type: 'dashboard', title: 'Dashboard'},
      },
      dashboardsById: {
        [dashboardId]: {
          ...createDashboardEntry(dashboardId),
          panels: [
            {
              id: panelId,
              type: 'vgplot',
              title: 'Magnitude vs depth',
              config: {
                chartType: 'bubble-chart',
                settings: {x: 'magnitude', y: 'depth'},
              },
            },
          ],
        },
      },
      runtimeIssues: {
        [`${dashboardId}:${panelId}`]: {
          kind: 'too-much-data',
          panelId,
          chartType: 'bubble-chart',
          message: 'Use a heatmap instead.',
          recoverable: true,
          rowCount: 20,
          limit: 10,
        },
      },
    });
    const tools = createDashboardAiTools({store, adapter});

    const result = await (tools.list_dashboard_panels as any).execute({
      artifactId: dashboardId,
      reasoning: 'inspect broken panels',
    });

    expect(result.llmResult.success).toBe(true);
    expect(result.llmResult.data.panels[0].issue).toMatchObject({
      kind: 'too-much-data',
      chartType: 'bubble-chart',
      rowCount: 20,
      limit: 10,
    });
  });
});
