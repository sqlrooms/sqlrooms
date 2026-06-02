import {type MosaicDashboardAddPanelAction} from './action-types';
import {addDataTableExplorerPanelAction} from '../data-table-explorer/addDataTableExplorerPanelAction';
import {addChartPanelAction} from '../chart/addChartPanelAction';

export const defaultAddPanelActions: MosaicDashboardAddPanelAction[] = [
  addDataTableExplorerPanelAction,
  addChartPanelAction,
];
