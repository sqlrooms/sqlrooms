import type {ComponentChartTypeDefinition} from '../base-types';
import {BoxPlotChartConfig, BoxPlotChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {BoxPlotPanelRenderer} from './renderer/BoxPlotPanelRenderer';
import {BoxPlotSettingsComponent} from './BoxPlotSettings';
import {createBoxPlotAiTool} from './tool';
import {AlignHorizontalDistributeCenter} from 'lucide-react';
import {BOX_PLOT_DESCRIPTION} from './constants';

export const boxPlotChartType: ComponentChartTypeDefinition<BoxPlotChartConfig> =
  {
    id: 'box-plot',
    label: 'Box Plot',
    description: BOX_PLOT_DESCRIPTION,
    icon: AlignHorizontalDistributeCenter,
    schema: BoxPlotChartSettings,
    settingsComponent: BoxPlotSettingsComponent,
    buildTitle: titleFromDescription(BOX_PLOT_DESCRIPTION),
    renderer: BoxPlotPanelRenderer,
    createTool: createBoxPlotAiTool,
  };
