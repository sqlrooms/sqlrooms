import {BarChart3} from 'lucide-react';
import {type MosaicDashboardAddPanelAction} from '../dashboard/MosaicDashboardAddPanelAction';
import {
  createMosaicDashboardChartPanelConfig,
  MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
} from '../dashboard/MosaicDashboardSlice';

export const addChartPanelAction: MosaicDashboardAddPanelAction = {
  type: MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
  label: 'Chart',
  icon: BarChart3,
  isEnabled: ({chartTypes}) => Boolean(chartTypes?.length),
  createPanel: () =>
    createMosaicDashboardChartPanelConfig('New Chart', {
      chartType: 'histogram',
      settings: {},
      settingsOpen: true,
    }),
};
