import type {ChartTypeDefinition} from '../base-types';
import {CountPlotChartConfig, CountPlotChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {CountPlotRenderer} from './CountPlotRenderer';
import {CountPlotSettingsComponent} from './CountPlotSettings';
import {createCountPlotAiTool} from './tool';
import {BarChartHorizontal} from 'lucide-react';

const DESCRIPTION = 'Create a count plot of a field';

export const countPlotChartType: ChartTypeDefinition<CountPlotChartConfig> = {
  id: 'count-plot',
  label: 'Count Plot',
  description: DESCRIPTION,
  aiDescription:
    'Use for a quick binned distribution of one numeric or temporal column.',
  icon: BarChartHorizontal,
  schema: CountPlotChartSettings,
  settingsComponent: CountPlotSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  renderer: CountPlotRenderer,
  createTool: createCountPlotAiTool,
};
