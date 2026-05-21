import type {SpecChartTypeDefinition} from '../base-types';
import {CountPlotChartConfig, CountPlotChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {CountPlotSettingsComponent} from './CountPlotSettings';
import {createCountPlotAiTool} from './tool';
import {BarChartHorizontal} from 'lucide-react';
import {createCountPlotSpec} from './spec';
import {COUNT_PLOT_DESCRIPTION} from './constants';

export const countPlotChartType: SpecChartTypeDefinition<CountPlotChartConfig> =
  {
    id: 'count-plot',
    label: 'Count Plot',
    description: COUNT_PLOT_DESCRIPTION,
    icon: BarChartHorizontal,
    schema: CountPlotChartSettings,
    settingsComponent: CountPlotSettingsComponent,
    buildTitle: titleFromDescription(COUNT_PLOT_DESCRIPTION),
    createTool: createCountPlotAiTool,
    createSpec: createCountPlotSpec,
  };
