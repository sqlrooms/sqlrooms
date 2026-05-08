import type {ChartTypeDefinition} from '../base-types';
import {CountPlotChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {CountPlotSettingsComponent} from './CountPlotSettings';
import {createCountPlotAiTool} from './tool';
import {createCountPlotSpec} from './spec';

const DESCRIPTION = 'Create a count plot of a field';

export const countPlotChartType: ChartTypeDefinition<CountPlotChartSettings> = {
  id: 'count-plot',
  label: 'Count Plot',
  description: DESCRIPTION,
  aiDescription:
    'Use for a quick binned distribution of one numeric or temporal column.',
  schema: CountPlotChartSettings,
  settingsComponent: CountPlotSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  createTool: createCountPlotAiTool,
  createSpec: createCountPlotSpec,
};
