/** @jest-environment jsdom */
import {expect, it, jest} from '@jest/globals';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
const setLayout = jest.fn(),
  setSelectedTable = jest.fn();
let readOnly = true,
  tableProps: any,
  layoutProps: any;
const state = {
  layout: {registerPanel: jest.fn()},
  mosaicDashboard: {
    setLayout,
    setSelectedTable,
    config: {
      dashboardsById: {
        dashboard: {
          selectedTable: 'sales',
          layoutType: 'grid',
          layout: {type: 'grid', id: 'grid'},
          panels: [{id: 'chart'}],
        },
      },
    },
  },
};
jest.unstable_mockModule('../src/dashboard/MosaicDashboardContext', () => ({
  useMosaicDashboardContext: () => ({dashboardId: 'dashboard', readOnly}),
}));
jest.unstable_mockModule('../src/dashboard/MosaicDashboardSlice', () => ({
  useStoreWithMosaicDashboard: (select: any) => select(state),
  getMosaicDashboardDockId: () => '',
  MOSAIC_DASHBOARD_PANEL: 'panel',
}));
jest.unstable_mockModule('../src/hooks/useTablesWithColumns', () => ({
  useTablesWithColumns: () => [],
}));
jest.unstable_mockModule('../src/mosaicTableReference', () => ({
  resolveMosaicTableReference: () => ({table: {table: 'sales'}}),
}));
jest.unstable_mockModule('@sqlrooms/db', () => ({
  getTableIdentity: () => 'new-table',
}));
jest.unstable_mockModule('../src/components/DataTableSelector', () => ({
  DataTableSelector: (props: any) => {
    tableProps = props;
    return null;
  },
  DataTableSelectorEmptyState: () => null,
}));
jest.unstable_mockModule('@sqlrooms/layout', () => ({
  isLayoutDockNode: () => false,
  isLayoutGridNode: () => true,
  LayoutRenderer: (props: any) => {
    layoutProps = props;
    return null;
  },
}));
jest.unstable_mockModule('../src/dashboard/panel/MosaicDashboardPanel', () => ({
  MosaicDashboardPanel: () => null,
}));
jest.unstable_mockModule(
  '../src/dashboard/panel/MosaicDashboardPanelDragOverlay',
  () => ({MosaicDashboardPanelDragOverlay: () => null}),
);
const {MosaicDashboardDataTableSelector} =
  await import('../src/dashboard/toolbar/MosaicDashboardDataTableSelector');
const {MosaicDashboardPanels} =
  await import('../src/dashboard/panel/MosaicDashboardPanels');
it('read-only dashboards block source and layout writes while writable composition retains them', async () => {
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    const render = () =>
      root.render(
        <>
          <MosaicDashboardDataTableSelector dashboardId="dashboard" />
          <MosaicDashboardPanels />
        </>,
      );
    await act(async () => render());
    expect(tableProps.disabled).toBe(true);
    tableProps.onChange({});
    layoutProps.onLayoutChange({type: 'grid'});
    expect(setSelectedTable).not.toHaveBeenCalled();
    expect(setLayout).not.toHaveBeenCalled();
    readOnly = false;
    await act(async () => render());
    expect(tableProps.disabled).toBe(false);
    tableProps.onChange({});
    layoutProps.onLayoutChange({type: 'grid'});
    expect(setSelectedTable).toHaveBeenCalledWith('dashboard', 'new-table');
    expect(setLayout).toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
  }
});
