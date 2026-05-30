import {
  MOSAIC_DASHBOARD_DATA_TABLE_EXPLORER_PANEL_TYPE,
  MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
  MOSAIC_DASHBOARD_TEXT_PANEL_TYPE,
} from './dashboard-types';
import {
  type AnyPanelRenderer,
  type PanelRenderersRecord,
} from './MosaicDashboardSlice';
import {mosaicDashboardDataTableExplorerPanelRenderer} from '../data-table-explorer/MosaicDashboardDataTableExplorerPanelRenderer';
import {mosaicDashboardChartRenderer} from '../chart/MosaicDashboardChartRenderer';
import {mosaicDashboardTextRenderer} from '../text/MosaicDashboardTextRenderer';

export function createDefaultMosaicDashboardPanelRenderers(
  extraRenderers: PanelRenderersRecord = {},
): PanelRenderersRecord {
  return {
    [MOSAIC_DASHBOARD_CHART_PANEL_TYPE]:
      mosaicDashboardChartRenderer as AnyPanelRenderer,
    [MOSAIC_DASHBOARD_DATA_TABLE_EXPLORER_PANEL_TYPE]:
      mosaicDashboardDataTableExplorerPanelRenderer as AnyPanelRenderer,
    [MOSAIC_DASHBOARD_TEXT_PANEL_TYPE]:
      mosaicDashboardTextRenderer as AnyPanelRenderer,
    ...extraRenderers,
  };
}
