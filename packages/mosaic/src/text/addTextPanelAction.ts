import {FileText} from 'lucide-react';
import {type MosaicDashboardAddPanelAction} from '../dashboard/dashboard-types';
import {
  createMosaicDashboardTextPanelConfig,
  MOSAIC_DASHBOARD_TEXT_PANEL_TYPE,
} from '../dashboard/MosaicDashboardSlice';

export const addTextPanelAction: MosaicDashboardAddPanelAction = {
  type: MOSAIC_DASHBOARD_TEXT_PANEL_TYPE,
  label: 'Text',
  icon: FileText,
  createPanel: () => createMosaicDashboardTextPanelConfig(),
};
