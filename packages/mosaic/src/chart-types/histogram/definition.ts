import type {ChartTypeDefinition} from '../base-types';
import {HistogramChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {HistogramSettingsComponent} from './HistogramSettings';
import {createHistogramAiTool} from './tool';
import {createHistogramSpec} from './spec';
import {BarChart3} from 'lucide-react';

const DESCRIPTION = 'Create a histogram of a field';

export const histogramChartType: ChartTypeDefinition<HistogramChartSettings> = {
  id: 'histogram',
  label: 'Histogram',
  description: DESCRIPTION,
  aiDescription:
    'Use for the distribution of one numeric or temporal column with count on the y-axis.',
  icon: BarChart3,
  schema: HistogramChartSettings,
  settingsComponent: HistogramSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  createTool: createHistogramAiTool,
  createSpec: createHistogramSpec,
};
