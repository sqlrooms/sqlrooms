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
  getMosaicDashboardPanelId,
  getMosaicDashboardSelectionName,
  MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
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
  return panelIds;
}

describe('MosaicDashboardSlice generic panels', () => {
  it('adds, updates, and removes dashboard panels with layout panels', () => {
    const store = createTestStore();
    const dashboardId = 'dashboard-1';
    const first = createMosaicDashboardVgPlotPanelConfig(
      {plot: [{mark: 'bar'}]},
      'Chart',
    );
    const second = createMosaicDashboardProfilerPanelConfig({
      source: {tableName: 'earthquakes'},
    });

    store.getState().mosaicDashboard.addPanel(dashboardId, first);
    store.getState().mosaicDashboard.addPanel(dashboardId, second);

    let dashboard =
      store.getState().mosaicDashboard.config.dashboardsById[dashboardId]!;
    expect(dashboard.panels.map((panel) => panel.id)).toEqual([
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
    expect(dashboard.panels.map((panel) => panel.id)).toEqual([second.id]);
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
    const panel = createMosaicDashboardVgPlotPanelConfig(
      {plot: [{mark: 'bar'}]},
      'Chart',
    );

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
    const first = createMosaicDashboardVgPlotPanelConfig(
      {plot: [{mark: 'bar'}]},
      'Chart 1',
    );
    const second = createMosaicDashboardVgPlotPanelConfig(
      {plot: [{mark: 'line'}]},
      'Chart 2',
    );

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
    const panel = createMosaicDashboardVgPlotPanelConfig(
      {plot: [{mark: 'bar'}]},
      'Chart',
    );

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
