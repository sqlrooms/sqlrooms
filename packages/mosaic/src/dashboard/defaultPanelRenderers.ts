import {
  MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
  MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
  MOSAIC_DASHBOARD_TEXT_PANEL_TYPE,
} from './dashboard-types';
import {
  type AnyPanelRenderer,
  type PanelRenderersRecord,
} from './MosaicDashboardSlice';
import {mosaicDashboardProfilerPanelRenderer} from '../profiler/MosaicDashboardProfilerPanelRenderer';
import {mosaicDashboardChartRenderer} from '../chart/MosaicDashboardChartRenderer';
import {mosaicDashboardTextRenderer} from '../text/MosaicDashboardTextRenderer';

export function createDefaultMosaicDashboardPanelRenderers(
  extraRenderers: PanelRenderersRecord = {},
): PanelRenderersRecord {
  return {
    [MOSAIC_DASHBOARD_CHART_PANEL_TYPE]:
      mosaicDashboardChartRenderer as AnyPanelRenderer,
    [MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE]:
      mosaicDashboardProfilerPanelRenderer as AnyPanelRenderer,
    [MOSAIC_DASHBOARD_TEXT_PANEL_TYPE]:
      mosaicDashboardTextRenderer as AnyPanelRenderer,
    ...extraRenderers,
  };
}
