import {jest} from '@jest/globals';
import {createStore} from 'zustand';
import {clausePoint} from '@uwdata/mosaic-core';
import {createLayoutSlice} from '@sqlrooms/layout';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createMosaicSlice} from '../src/MosaicSlice';
import {createMosaicDashboardSlice} from '../src/dashboard/MosaicDashboardSlice';
import {
  createMosaicDashboardProfilerPanelConfig,
  createMosaicDashboardVgPlotPanelConfig,
  getMosaicDashboardGridId,
  getMosaicDashboardPanelId,
  getMosaicDashboardSelectionName,
  MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
  MosaicDashboardEntry,
  type CreateMosaicDashboardSliceProps,
} from '../src';
import type {LayoutNode} from '@sqlrooms/layout-config';

function createTestStore(props: CreateMosaicDashboardSliceProps = {}) {
  return createStore<BaseRoomStoreState & any>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createLayoutSlice()(...args),
    ...createMosaicSlice()(...args),
    ...createMosaicDashboardSlice(props)(...args),
  }));
}

function createRuntimeChart() {
  const destroy = jest.fn();
  const element = {
    value: {
      marks: [{destroy}],
    },
  } as unknown as HTMLElement & {value?: unknown};
  return {
    chart: {
      element,
      specKey: '{"plot":[{"mark":"bar"}]}',
    },
    destroy,
  };
}

function collectPanelIds(
  layout: LayoutNode | null | undefined,
  panelIds = new Set<string>(),
) {
  if (!layout || typeof layout === 'string') {
    if (layout) panelIds.add(layout);
    return panelIds;
  }
  if (layout.type === 'panel') {
    panelIds.add(layout.id);
  }
  if (layout.type === 'split') {
    for (const child of layout.children) {
      collectPanelIds(child, panelIds);
    }
  }
  if (layout.type === 'grid') {
    for (const child of layout.children) {
      collectPanelIds(child, panelIds);
    }
  }
  return panelIds;
}

describe('MosaicDashboardSlice generic panels', () => {
  it('defaults parsed legacy dashboards to dock layout type', () => {
    const dashboard = MosaicDashboardEntry.parse({
      id: 'legacy-dashboard',
      title: 'Legacy dashboard',
    });

    expect(dashboard.layoutType).toBe('dock');
  });

  it('creates grid dashboards and keeps their layout type on re-ensure', () => {
    const store = createTestStore();
    const dashboardId = store
      .getState()
      .mosaicDashboard.createDashboard('Grid dashboard', 'grid');

    store
      .getState()
      .mosaicDashboard.ensureDashboard(dashboardId, 'Renamed', 'dock');

    const dashboard =
      store.getState().mosaicDashboard.config.dashboardsById[dashboardId]!;
    expect(dashboard.title).toBe('Renamed');
    expect(dashboard.layoutType).toBe('grid');
    expect(dashboard.layout?.type).toBe('grid');
    expect(dashboard.layout?.id).toBe(getMosaicDashboardGridId(dashboardId));
  });

  it('adds and removes grid dashboard panels with persisted grid layouts', () => {
    const store = createTestStore();
    const dashboardId = store
      .getState()
      .mosaicDashboard.createDashboard('Grid dashboard', 'grid');
    const first = createMosaicDashboardVgPlotPanelConfig('Chart', {
      chartType: 'histogram',
      settings: {field: 'amount'},
    });
    const second = createMosaicDashboardProfilerPanelConfig({
      source: {tableName: 'earthquakes'},
    });

    store.getState().mosaicDashboard.addPanel(dashboardId, first);
    store.getState().mosaicDashboard.addPanel(dashboardId, second);

    let dashboard =
      store.getState().mosaicDashboard.config.dashboardsById[dashboardId]!;
    const firstLayoutId = getMosaicDashboardPanelId(dashboardId, first.id);
    const secondLayoutId = getMosaicDashboardPanelId(dashboardId, second.id);
    expect(dashboard.layout?.type).toBe('grid');
    expect(collectPanelIds(dashboard.layout)).toEqual(
      new Set([firstLayoutId, secondLayoutId]),
    );
    expect(
      dashboard.layout?.type === 'grid' ? dashboard.layout.layouts?.lg : [],
    ).toEqual([
      expect.objectContaining({i: firstLayoutId, x: 0, y: 0, w: 6, h: 2}),
      expect.objectContaining({i: secondLayoutId, x: 0, y: 2, w: 12, h: 2}),
    ]);

    store.getState().mosaicDashboard.removePanel(dashboardId, first.id);

    dashboard =
      store.getState().mosaicDashboard.config.dashboardsById[dashboardId]!;
    expect(collectPanelIds(dashboard.layout)).toEqual(
      new Set([secondLayoutId]),
    );
    expect(
      dashboard.layout?.type === 'grid' ? dashboard.layout.layouts?.lg : [],
    ).toEqual([expect.objectContaining({i: secondLayoutId})]);
  });

  it('sizes new grid chart and map panels to half rows and profilers to full rows', () => {
    const store = createTestStore();
    const dashboardId = store
      .getState()
      .mosaicDashboard.createDashboard('Grid dashboard', 'grid');
    const chart = createMosaicDashboardVgPlotPanelConfig('Chart', {
      chartType: 'histogram',
      settings: {field: 'amount'},
    });
    const map = {
      id: 'map-panel',
      type: 'deck-json-map',
      title: 'Map',
      config: {},
    };
    const profiler = createMosaicDashboardProfilerPanelConfig();

    store.getState().mosaicDashboard.addPanel(dashboardId, chart);
    store.getState().mosaicDashboard.addPanel(dashboardId, map);
    store.getState().mosaicDashboard.addPanel(dashboardId, profiler);

    const dashboard =
      store.getState().mosaicDashboard.config.dashboardsById[dashboardId]!;
    const chartLayoutId = getMosaicDashboardPanelId(dashboardId, chart.id);
    const mapLayoutId = getMosaicDashboardPanelId(dashboardId, map.id);
    const profilerLayoutId = getMosaicDashboardPanelId(
      dashboardId,
      profiler.id,
    );

    expect(
      dashboard.layout?.type === 'grid' ? dashboard.layout.layouts?.lg : [],
    ).toEqual([
      expect.objectContaining({i: chartLayoutId, x: 0, y: 0, w: 6, h: 2}),
      expect.objectContaining({i: mapLayoutId, x: 6, y: 0, w: 6, h: 2}),
      expect.objectContaining({i: profilerLayoutId, x: 0, y: 2, w: 12, h: 2}),
    ]);
    expect(
      dashboard.layout?.type === 'grid' ? dashboard.layout.layouts?.sm : [],
    ).toEqual([
      expect.objectContaining({i: chartLayoutId, x: 0, y: 0, w: 3, h: 2}),
      expect.objectContaining({i: mapLayoutId, x: 3, y: 0, w: 3, h: 2}),
      expect.objectContaining({i: profilerLayoutId, x: 0, y: 2, w: 6, h: 2}),
    ]);
  });

  it('preserves missing grid dashboard panels when setting layout', () => {
    const store = createTestStore();
    const dashboardId = store
      .getState()
      .mosaicDashboard.createDashboard('Grid dashboard', 'grid');
    const first = createMosaicDashboardProfilerPanelConfig();
    const second = createMosaicDashboardProfilerPanelConfig();

    store.getState().mosaicDashboard.addPanel(dashboardId, first);
    store.getState().mosaicDashboard.addPanel(dashboardId, second);

    const dashboard =
      store.getState().mosaicDashboard.config.dashboardsById[dashboardId]!;
    if (dashboard.layout?.type !== 'grid') {
      throw new Error('Expected grid layout');
    }
    const layoutWithMissingPanel: LayoutNode = {
      ...dashboard.layout,
      children: dashboard.layout.children.slice(0, 1),
      layouts: {
        lg: dashboard.layout.layouts?.lg?.slice(0, 1) ?? [],
      },
    };

    store
      .getState()
      .mosaicDashboard.setLayout(dashboardId, layoutWithMissingPanel);

    const nextDashboard =
      store.getState().mosaicDashboard.config.dashboardsById[dashboardId]!;
    expect(collectPanelIds(nextDashboard.layout)).toEqual(
      new Set([
        getMosaicDashboardPanelId(dashboardId, first.id),
        getMosaicDashboardPanelId(dashboardId, second.id),
      ]),
    );
    expect(
      nextDashboard.layout?.type === 'grid'
        ? nextDashboard.layout.layouts?.lg?.find(
            (item) =>
              item.i === getMosaicDashboardPanelId(dashboardId, second.id),
          )
        : undefined,
    ).toMatchObject({w: 12});
    expect(
      nextDashboard.layout?.type === 'grid'
        ? nextDashboard.layout.layouts?.sm?.find(
            (item) =>
              item.i === getMosaicDashboardPanelId(dashboardId, second.id),
          )
        : undefined,
    ).toMatchObject({w: 6});
  });

  it('normalizes incoming dock layouts to grid without losing dashboard panels', () => {
    const store = createTestStore();
    const dashboardId = store
      .getState()
      .mosaicDashboard.createDashboard('Grid dashboard', 'grid');
    const first = createMosaicDashboardProfilerPanelConfig();
    const second = createMosaicDashboardProfilerPanelConfig();
    const firstLayoutId = getMosaicDashboardPanelId(dashboardId, first.id);
    const secondLayoutId = getMosaicDashboardPanelId(dashboardId, second.id);

    store.getState().mosaicDashboard.addPanel(dashboardId, first);
    store.getState().mosaicDashboard.addPanel(dashboardId, second);

    const dockShapedLayout: LayoutNode = {
      type: 'split',
      id: 'incoming-dock-layout',
      direction: 'row',
      children: [
        {
          type: 'panel',
          id: firstLayoutId,
          panel: {key: 'mosaic-dashboard-panel'},
        },
      ],
    };

    store.getState().mosaicDashboard.setLayout(dashboardId, dockShapedLayout);

    const dashboard =
      store.getState().mosaicDashboard.config.dashboardsById[dashboardId]!;
    expect(dashboard.layout?.type).toBe('grid');
    expect(collectPanelIds(dashboard.layout)).toEqual(
      new Set([firstLayoutId, secondLayoutId]),
    );
    expect(
      dashboard.layout?.type === 'grid' ? dashboard.layout.layouts?.lg : [],
    ).toEqual([
      expect.objectContaining({i: firstLayoutId}),
      expect.objectContaining({i: secondLayoutId, w: 12}),
    ]);
  });

  it('adds, updates, and removes dashboard panels with layout panels', () => {
    const store = createTestStore();
    const dashboardId = 'dashboard-1';
    const first = createMosaicDashboardVgPlotPanelConfig('Chart', {
      chartType: 'histogram',
      settings: {
        field: 'amount',
      },
    });
    const second = createMosaicDashboardProfilerPanelConfig({
      source: {tableName: 'earthquakes'},
    });

    store.getState().mosaicDashboard.addPanel(dashboardId, first);
    store.getState().mosaicDashboard.addPanel(dashboardId, second);

    let dashboard =
      store.getState().mosaicDashboard.config.dashboardsById[dashboardId]!;
    expect(dashboard.panels.map((panel: {id: string}) => panel.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(collectPanelIds(dashboard.layout)).toEqual(
      new Set([
        getMosaicDashboardPanelId(dashboardId, first.id),
        getMosaicDashboardPanelId(dashboardId, second.id),
      ]),
    );

    store.getState().mosaicDashboard.updatePanel(dashboardId, first.id, {
      title: 'Updated chart',
      config: {vgplot: {plot: [{mark: 'line'}]}},
    });

    dashboard =
      store.getState().mosaicDashboard.config.dashboardsById[dashboardId]!;
    expect(dashboard.panels[0]?.title).toBe('Updated chart');
    expect(dashboard.panels[0]?.config.vgplot).toEqual({
      plot: [{mark: 'line'}],
    });

    store.getState().mosaicDashboard.removePanel(dashboardId, first.id);
    dashboard =
      store.getState().mosaicDashboard.config.dashboardsById[dashboardId]!;
    expect(dashboard.panels.map((panel: {id: string}) => panel.id)).toEqual([
      second.id,
    ]);
    expect(collectPanelIds(dashboard.layout)).toEqual(
      new Set([getMosaicDashboardPanelId(dashboardId, second.id)]),
    );
  });

  it('preserves missing dashboard panels when setting layout', () => {
    const store = createTestStore();
    const dashboardId = 'dashboard-2';
    const first = createMosaicDashboardProfilerPanelConfig();
    const second = createMosaicDashboardProfilerPanelConfig();

    store.getState().mosaicDashboard.addPanel(dashboardId, first);
    store.getState().mosaicDashboard.addPanel(dashboardId, second);
    store.getState().mosaicDashboard.setLayout(dashboardId, null);

    const dashboard =
      store.getState().mosaicDashboard.config.dashboardsById[dashboardId]!;
    expect(collectPanelIds(dashboard.layout)).toEqual(
      new Set([
        getMosaicDashboardPanelId(dashboardId, first.id),
        getMosaicDashboardPanelId(dashboardId, second.id),
      ]),
    );
  });

  it('registers and unregisters panel renderers outside persisted config', () => {
    const component = () => null;
    const store = createTestStore({
      panelRenderers: {
        [MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE]: {component},
      },
    });

    expect(
      store.getState().mosaicDashboard.panelRenderers[
        MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE
      ]?.component,
    ).toBe(component);
    expect(store.getState().mosaicDashboard.config).not.toHaveProperty(
      'panelRenderers',
    );

    store
      .getState()
      .mosaicDashboard.unregisterPanelRenderer(
        MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
      );
    expect(
      store.getState().mosaicDashboard.panelRenderers[
        MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE
      ],
    ).toBeUndefined();
  });

  it('evicts panel runtime on update and remove', () => {
    const store = createTestStore();
    const dashboardId = 'dashboard-runtime-1';
    const panel = createMosaicDashboardVgPlotPanelConfig('Chart', {
      chartType: 'histogram',
      settings: {field: 'amount'},
    });

    store.getState().mosaicDashboard.addPanel(dashboardId, panel);
    const firstRuntime = createRuntimeChart();
    store
      .getState()
      .mosaicDashboard.setRetainedChart(
        dashboardId,
        panel.id,
        firstRuntime.chart,
      );

    store.getState().mosaicDashboard.updatePanel(dashboardId, panel.id, {
      config: {vgplot: {plot: [{mark: 'line'}]}},
    });

    expect(firstRuntime.destroy).toHaveBeenCalledTimes(1);
    expect(
      store.getState().mosaicDashboard.getRetainedChart(dashboardId, panel.id),
    ).toBeUndefined();

    const secondRuntime = createRuntimeChart();
    store
      .getState()
      .mosaicDashboard.setRetainedChart(
        dashboardId,
        panel.id,
        secondRuntime.chart,
      );

    store.getState().mosaicDashboard.removePanel(dashboardId, panel.id);

    expect(secondRuntime.destroy).toHaveBeenCalledTimes(1);
    expect(
      store.getState().mosaicDashboard.getRetainedChart(dashboardId, panel.id),
    ).toBeUndefined();
  });

  it('evicts dashboard runtime and resets only that dashboard selection', () => {
    const store = createTestStore();
    const dashboardId = 'dashboard-runtime-2';
    const otherDashboardId = 'dashboard-runtime-3';
    const first = createMosaicDashboardVgPlotPanelConfig('Chart 1', {
      chartType: 'histogram',
      settings: {field: 'amount'},
    });
    const second = createMosaicDashboardVgPlotPanelConfig('Chart 2', {
      chartType: 'line-chart',
      settings: {x: 'id', yFields: [{field: 'value', aggregate: 'sum'}]},
    });

    store.getState().mosaicDashboard.addPanel(dashboardId, first);
    store.getState().mosaicDashboard.addPanel(otherDashboardId, second);

    const firstRuntime = createRuntimeChart();
    const secondRuntime = createRuntimeChart();
    store
      .getState()
      .mosaicDashboard.setRetainedChart(
        dashboardId,
        first.id,
        firstRuntime.chart,
      );
    store
      .getState()
      .mosaicDashboard.setRetainedChart(
        otherDashboardId,
        second.id,
        secondRuntime.chart,
      );

    const firstSelection = store
      .getState()
      .mosaic.getSelection(getMosaicDashboardSelectionName(dashboardId));
    const secondSelection = store
      .getState()
      .mosaic.getSelection(getMosaicDashboardSelectionName(otherDashboardId));

    firstSelection.update(clausePoint('value', 1, {source: {}}));
    secondSelection.update(clausePoint('value', 2, {source: {}}));

    store.getState().mosaicDashboard.evictDashboardRuntime(dashboardId, {
      resetSelection: true,
    });

    expect(firstRuntime.destroy).toHaveBeenCalledTimes(1);
    expect(secondRuntime.destroy).not.toHaveBeenCalled();
    expect(firstSelection.clauses).toHaveLength(0);
    expect(secondSelection.clauses).toHaveLength(1);
    expect(
      store.getState().mosaicDashboard.getRetainedChart(dashboardId, first.id),
    ).toBeUndefined();
    expect(
      store
        .getState()
        .mosaicDashboard.getRetainedChart(otherDashboardId, second.id),
    ).toBe(secondRuntime.chart);
  });

  it('removes dashboards after evicting runtime and selection state', () => {
    const store = createTestStore();
    const dashboardId = 'dashboard-runtime-4';
    const panel = createMosaicDashboardVgPlotPanelConfig('Chart', {
      chartType: 'histogram',
      settings: {
        field: 'amount',
      },
    });

    store.getState().mosaicDashboard.addPanel(dashboardId, panel);
    const runtime = createRuntimeChart();
    store
      .getState()
      .mosaicDashboard.setRetainedChart(dashboardId, panel.id, runtime.chart);

    const selection = store
      .getState()
      .mosaic.getSelection(getMosaicDashboardSelectionName(dashboardId));
    selection.update(clausePoint('value', 1, {source: {}}));

    store.getState().mosaicDashboard.removeDashboard(dashboardId);

    expect(runtime.destroy).toHaveBeenCalledTimes(1);
    expect(selection.clauses).toHaveLength(0);
    expect(
      store.getState().mosaicDashboard.config.dashboardsById[dashboardId],
    ).toBeUndefined();
  });
});
