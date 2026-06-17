import {BarChart3} from 'lucide-react';
import {type MosaicDashboardAddPanelAction} from '../dashboard/action-types';
import {
  createMosaicDashboardChartPanelConfig,
  MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
} from '../dashboard/MosaicDashboardSlice';

export const addChartPanelAction: MosaicDashboardAddPanelAction = {
  type: MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
  label: 'Chart',
  icon: BarChart3,
  isEnabled: ({chartTypes}) => Boolean(chartTypes?.length),
  createPanel: ({chartTypes}) =>
    createMosaicDashboardChartPanelConfig('New Chart', {
      chartType: chartTypes?.[0]?.id ?? 'histogram',
      settings: {},
      settingsOpen: true,
    }),
};
