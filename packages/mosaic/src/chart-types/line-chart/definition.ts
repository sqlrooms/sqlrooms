import type {ChartTypeDefinition} from '../base-types';
import {LineChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {LineChartSettingsComponent} from './LineChartSettings';
import {createLineChartAiTool} from './tool';
import {createLineChartSpec} from './spec';

const DESCRIPTION = 'Create a line chart of two fields';

export const lineChartChartType: ChartTypeDefinition<LineChartSettings> = {
  id: 'line-chart',
  label: 'Line Chart',
  description: DESCRIPTION,
  aiDescription:
    'Use for trends over an ordered x-axis, typically time on x and numeric measures on y. Supports multiple Y fields for comparing trends.',
  schema: LineChartSettings,
  settingsComponent: LineChartSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  createTool: createLineChartAiTool,
  createSpec: createLineChartSpec,
};
