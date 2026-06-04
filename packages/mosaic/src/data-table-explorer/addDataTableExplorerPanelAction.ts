import {TableProperties} from 'lucide-react';
import {type MosaicDashboardAddPanelAction} from '../dashboard/action-types';
import {
  createMosaicDashboardDataTableExplorerPanelConfig,
  MOSAIC_DASHBOARD_DATA_TABLE_EXPLORER_PANEL_TYPE,
} from '../dashboard/MosaicDashboardSlice';

export const addDataTableExplorerPanelAction: MosaicDashboardAddPanelAction = {
  type: MOSAIC_DASHBOARD_DATA_TABLE_EXPLORER_PANEL_TYPE,
  label: 'Data Table',
  icon: TableProperties,
  createPanel: () => createMosaicDashboardDataTableExplorerPanelConfig(),
};
