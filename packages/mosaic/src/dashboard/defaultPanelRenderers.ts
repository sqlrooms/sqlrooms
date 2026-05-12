import {
  MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
  MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
  type AnyPanelRenderer,
  type PanelRenderersRecord,
} from './MosaicDashboardSlice';
import {mosaicDashboardProfilerPanelRenderer} from './MosaicDashboardProfilerPanelRenderer';
import {mosaicDashboardChartRenderer} from './MosaicDashboardChartRenderer';

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
