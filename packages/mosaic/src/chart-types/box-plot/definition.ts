import type {ChartTypeDefinition} from '../base-types';
import {BoxPlotChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {BoxPlotSettingsComponent} from './BoxPlotSettings';
import {createBoxPlotAiTool} from './tool';
import {createBoxPlotSpec} from './spec';

const DESCRIPTION = 'Create a box plot';

export const boxPlotChartType: ChartTypeDefinition<BoxPlotChartSettings> = {
  id: 'box-plot',
  label: 'Box Plot',
  description: DESCRIPTION,
  aiDescription:
    'Use for comparing the distribution of a numeric measure across categories.',
  schema: BoxPlotChartSettings,
  settingsComponent: BoxPlotSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  createTool: createBoxPlotAiTool,
  createSpec: createBoxPlotSpec,
};
