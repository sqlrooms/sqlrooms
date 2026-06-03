import type {SpecChartTypeDefinition} from '../base-types';
import {HistogramChartConfig, HistogramChartSettings} from './schema';
import {titleFromDescription} from '../../../chart-builders/chartTypeUtils';
import {HistogramSettingsComponent} from './HistogramSettings';
import {createHistogramAiTool} from './tool';
import {BarChart3} from 'lucide-react';
import {createHistogramSpec} from './spec';

const DESCRIPTION = 'Create a histogram of a field';

export const histogramChartType: SpecChartTypeDefinition<HistogramChartConfig> =
  {
    id: 'histogram',
    label: 'Histogram',
    description: DESCRIPTION,
    icon: BarChart3,
    schema: HistogramChartSettings,
    settingsComponent: HistogramSettingsComponent,
    buildTitle: titleFromDescription(DESCRIPTION),
    createTool: createHistogramAiTool,
    createSpec: createHistogramSpec,
  };
