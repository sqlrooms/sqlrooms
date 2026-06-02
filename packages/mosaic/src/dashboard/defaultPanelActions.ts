import {type MosaicDashboardAddPanelAction} from './action-types';
import {addDataTableExplorerPanelAction} from '../data-table-explorer/addDataTableExplorerPanelAction';
import {addChartPanelAction} from '../charts/addChartPanelAction';

export const defaultAddPanelActions: MosaicDashboardAddPanelAction[] = [
  addDataTableExplorerPanelAction,
  addChartPanelAction,
];
