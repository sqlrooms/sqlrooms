import {
  MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
  MOSAIC_DASHBOARD_VGPLOT_PANEL_TYPE,
  type MosaicDashboardPanelRenderer,
} from './MosaicDashboardSlice';
import {mosaicDashboardProfilerPanelRenderer} from './MosaicDashboardProfilerPanelRenderer';
import {mosaicDashboardVgPlotPanelRenderer} from './MosaicDashboardVgPlotPanelRenderer';

export function createDefaultMosaicDashboardPanelRenderers(
  extraRenderers: Record<string, MosaicDashboardPanelRenderer> = {},
): Record<string, MosaicDashboardPanelRenderer> {
  return {
    [MOSAIC_DASHBOARD_VGPLOT_PANEL_TYPE]: mosaicDashboardVgPlotPanelRenderer,
    [MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE]:
      mosaicDashboardProfilerPanelRenderer,
    ...extraRenderers,
  };
}
