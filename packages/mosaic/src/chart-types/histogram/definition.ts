import type {SpecChartTypeDefinition} from '../base-types';
import {HistogramChartConfig, HistogramChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {HistogramSettingsComponent} from './HistogramSettings';
import {createHistogramAiTool} from './tool';
import {BarChart3} from 'lucide-react';
import {createHistogramSpec} from './spec';
import {MAX_HISTOGRAM_DATA_POINTS, HISTOGRAM_DESCRIPTION} from './constants';

export const histogramChartType: SpecChartTypeDefinition<HistogramChartConfig> =
  {
    id: 'histogram',
    label: 'Histogram',
    description: HISTOGRAM_DESCRIPTION,
    icon: BarChart3,
    schema: HistogramChartSettings,
    settingsComponent: HistogramSettingsComponent,
    buildTitle: titleFromDescription(HISTOGRAM_DESCRIPTION),
    createTool: createHistogramAiTool,
    createSpec: createHistogramSpec,
    maxDataPoints: MAX_HISTOGRAM_DATA_POINTS,
  };
