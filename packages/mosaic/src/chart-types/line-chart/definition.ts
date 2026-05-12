import type {ChartTypeDefinition} from '../base-types';
import {LineChartConfig, LineChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {LineChartRenderer} from './LineChartRenderer';
import {LineChartSettingsComponent} from './LineChartSettings';
import {createLineChartAiTool} from './tool';
import {LineChart} from 'lucide-react';

const DESCRIPTION = 'Create a line chart of two fields';

export const lineChartChartType: ChartTypeDefinition<LineChartConfig> = {
  id: 'line-chart',
  label: 'Line Chart',
  description: DESCRIPTION,
  aiDescription:
    'Use for trends over an ordered x-axis, typically time on x and numeric measures on y. Supports multiple Y fields for comparing trends.',
  icon: LineChart,
  schema: LineChartSettings,
  settingsComponent: LineChartSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  renderer: LineChartRenderer,
  createTool: createLineChartAiTool,
};
