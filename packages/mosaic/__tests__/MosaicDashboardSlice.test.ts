import {createStore} from 'zustand';
import {createLayoutSlice} from '@sqlrooms/layout';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createMosaicDashboardSlice} from '../src/dashboard/MosaicDashboardSlice';
import {
  createMosaicDashboardProfilerPanelConfig,
  createMosaicDashboardVgPlotPanelConfig,
  getMosaicDashboardPanelId,
  MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
  type CreateMosaicDashboardSliceProps,
} from '../src';
import type {LayoutNode} from '@sqlrooms/layout-config';

function createTestStore(props: CreateMosaicDashboardSliceProps = {}) {
  return createStore<BaseRoomStoreState & any>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createLayoutSlice()(...args),
    ...createMosaicDashboardSlice(props)(...args),
  }));
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
});
