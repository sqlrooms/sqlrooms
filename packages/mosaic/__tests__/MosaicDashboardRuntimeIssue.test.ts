import {createStore} from 'zustand';
import {createLayoutSlice} from '@sqlrooms/layout';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createMosaicSlice} from '../src/MosaicSlice';
import {
  createMosaicDashboardChartPanelConfig,
  createMosaicDashboardSlice,
  type CreateMosaicDashboardSliceProps,
} from '../src/dashboard/MosaicDashboardSlice';

function createTestStore(props: CreateMosaicDashboardSliceProps = {}) {
  return createStore<BaseRoomStoreState & any>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createLayoutSlice()(...args),
    ...createMosaicSlice()(...args),
    ...createMosaicDashboardSlice(props)(...args),
  }));
}

describe('Mosaic dashboard runtime issues', () => {
  it('stores panel issues outside dashboard config and evicts them with panel runtime', () => {
    const store = createTestStore();
    const dashboardId = store
      .getState()
      .mosaicDashboard.createDashboard('Grid dashboard', 'grid');
    const panel = createMosaicDashboardChartPanelConfig('Chart', {
      chartType: 'bubble-chart',
      settings: {x: 'longitude', y: 'latitude'},
    });

    store.getState().mosaicDashboard.addPanel(dashboardId, panel);
    store.getState().mosaicDashboard.reportPanelIssue(dashboardId, panel.id, {
      kind: 'too-much-data',
      panelId: panel.id,
      chartType: 'bubble-chart',
      message: 'Too many rows',
      recoverable: true,
      rowCount: 12,
      limit: 10,
    });

    expect(
      store.getState().mosaicDashboard.getPanelIssue(dashboardId, panel.id),
    ).toMatchObject({kind: 'too-much-data', rowCount: 12});
    expect(
      JSON.stringify(
        store.getState().mosaicDashboard.config.dashboardsById[dashboardId],
      ),
    ).not.toContain('Too many rows');

    store.getState().mosaicDashboard.evictPanelRuntime(dashboardId, panel.id);

    expect(
      store.getState().mosaicDashboard.getPanelIssue(dashboardId, panel.id),
    ).toBeUndefined();
  });
});
