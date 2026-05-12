import type {ComponentChartTypeDefinition} from '../base-types';
import {BoxPlotChartConfig, BoxPlotChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {BoxPlotPanelRenderer} from './BoxPlotPanelRenderer';
import {BoxPlotSettingsComponent} from './BoxPlotSettings';
import {createBoxPlotAiTool} from './tool';
import {AlignHorizontalDistributeCenter} from 'lucide-react';

const DESCRIPTION = 'Create a box plot';

export const boxPlotChartType: ComponentChartTypeDefinition<BoxPlotChartConfig> =
  {
    id: 'box-plot',
    label: 'Box Plot',
    description: DESCRIPTION,
    aiDescription:
      'Use for comparing the distribution of a numeric measure across categories.',
    icon: AlignHorizontalDistributeCenter,
    schema: BoxPlotChartSettings,
    settingsComponent: BoxPlotSettingsComponent,
    buildTitle: titleFromDescription(DESCRIPTION),
    renderer: BoxPlotPanelRenderer,
    createTool: createBoxPlotAiTool,
  };
