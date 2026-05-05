import {
  MOSAIC_DASHBOARD_BOXPLOT_PANEL_TYPE,
  MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
  MOSAIC_DASHBOARD_VGPLOT_PANEL_TYPE,
  type AnyPanelRenderer,
  type PanelRenderersRecord,
} from './MosaicDashboardSlice';
import {mosaicDashboardBoxPlotPanelRenderer} from './MosaicDashboardBoxPlotPanelRenderer';
import {mosaicDashboardProfilerPanelRenderer} from './MosaicDashboardProfilerPanelRenderer';
import {mosaicDashboardVgPlotPanelRenderer} from './MosaicDashboardVgPlotPanelRenderer';

export function createDefaultMosaicDashboardPanelRenderers(
  extraRenderers: PanelRenderersRecord = {},
): PanelRenderersRecord {
  return {
    [MOSAIC_DASHBOARD_VGPLOT_PANEL_TYPE]:
      mosaicDashboardVgPlotPanelRenderer as AnyPanelRenderer,
    [MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE]:
      mosaicDashboardProfilerPanelRenderer as AnyPanelRenderer,
    [MOSAIC_DASHBOARD_BOXPLOT_PANEL_TYPE]:
      mosaicDashboardBoxPlotPanelRenderer as AnyPanelRenderer,
    ...extraRenderers,
  };
}
