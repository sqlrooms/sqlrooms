import {
  MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
  MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
  type AnyPanelRenderer,
  type PanelRenderersRecord,
} from './MosaicDashboardSlice';
import {mosaicDashboardProfilerPanelRenderer} from '../profiler/MosaicDashboardProfilerPanelRenderer';
import {mosaicDashboardChartRenderer} from '../chart/MosaicDashboardChartRenderer';

export function createDefaultMosaicDashboardPanelRenderers(
  extraRenderers: PanelRenderersRecord = {},
): PanelRenderersRecord {
  return {
    [MOSAIC_DASHBOARD_CHART_PANEL_TYPE]:
      mosaicDashboardChartRenderer as AnyPanelRenderer,
    [MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE]:
      mosaicDashboardProfilerPanelRenderer as AnyPanelRenderer,
    ...extraRenderers,
  };
}
