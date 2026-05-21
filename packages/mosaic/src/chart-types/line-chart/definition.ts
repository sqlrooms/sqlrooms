import type {SpecChartTypeDefinition} from '../base-types';
import {LineChartConfig, LineChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {LineChartSettingsComponent} from './LineChartSettings';
import {createLineChartAiTool} from './tool';
import {LineChart} from 'lucide-react';
import {createLineChartSpec} from './spec';
import {MAX_LINE_CHART_DATA_POINTS, LINE_CHART_DESCRIPTION} from './constants';

export const lineChartChartType: SpecChartTypeDefinition<LineChartConfig> = {
  id: 'line-chart',
  label: 'Line Chart',
  description: LINE_CHART_DESCRIPTION,
  icon: LineChart,
  schema: LineChartSettings,
  settingsComponent: LineChartSettingsComponent,
  buildTitle: titleFromDescription(LINE_CHART_DESCRIPTION),
  createTool: createLineChartAiTool,
  createSpec: createLineChartSpec,
  maxDataPoints: MAX_LINE_CHART_DATA_POINTS,
};
