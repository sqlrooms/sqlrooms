import {type MosaicDashboardAddPanelAction} from './dashboard-types';
import {addTextPanelAction} from '../text/addTextPanelAction';
import {addProfilerPanelAction} from '../profiler/addProfilerPanelAction';
import {addChartPanelAction} from '../chart/addChartPanelAction';

export const defaultAddPanelActions: MosaicDashboardAddPanelAction[] = [
  addProfilerPanelAction,
  addTextPanelAction,
  addChartPanelAction,
];
