import {type MosaicDashboardAddPanelAction} from './MosaicDashboardAddPanelAction';
import {addTextPanelAction} from '../text/addTextPanelAction';
import {addProfilerPanelAction} from '../profiler/addProfilerPanelAction';
import {addChartPanelAction} from '../chart/addChartPanelAction';

export const defaultAddPanelActions: MosaicDashboardAddPanelAction[] = [
  addProfilerPanelAction,
  addTextPanelAction,
  addChartPanelAction,
];
