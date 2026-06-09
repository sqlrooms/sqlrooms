import type {SpecChartTypeDefinition} from '../base-types';
import {ScatterChartConfig, ScatterChartSettings} from './schema';
import {titleFromDescription} from '../../../chart-builders/chartTypeUtils';
import {ScatterChartSettingsComponent} from './ScatterChartSettings';
import {createScatterChartAiTool} from './tool';
import {Workflow} from 'lucide-react';
import {createScatterChartSpec} from './spec';
import {DEFAULT_CHART_MAX_DATA_POINTS} from '../../../chart-runtime';

const DESCRIPTION = 'Create a scatter chart';

export const scatterChartChartType: SpecChartTypeDefinition<ScatterChartConfig> =
  {
    id: 'scatter-chart',
    label: 'Scatter',
    description: DESCRIPTION,
    icon: Workflow,
    schema: ScatterChartSettings,
    settingsComponent: ScatterChartSettingsComponent,
    buildTitle: titleFromDescription(DESCRIPTION),
    createTool: createScatterChartAiTool,
    getDataPolicy: () => ({
      maxRows: DEFAULT_CHART_MAX_DATA_POINTS,
      reason:
        'Scatter charts render one point per row. Use a heatmap or another aggregated chart for larger datasets.',
    }),
    createSpec: createScatterChartSpec,
  };
