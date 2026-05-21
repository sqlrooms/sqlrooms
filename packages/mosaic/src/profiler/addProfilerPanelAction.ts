import {TableProperties} from 'lucide-react';
import {type MosaicDashboardAddPanelAction} from '../dashboard/action-types';
import {
  createMosaicDashboardProfilerPanelConfig,
  MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
} from '../dashboard/MosaicDashboardSlice';

export const addProfilerPanelAction: MosaicDashboardAddPanelAction = {
  type: MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
  label: 'Data Table',
  icon: TableProperties,
  createPanel: () => createMosaicDashboardProfilerPanelConfig(),
};
