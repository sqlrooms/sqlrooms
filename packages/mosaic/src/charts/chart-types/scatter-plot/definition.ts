import type {SpecChartTypeDefinition} from '../base-types';
import {ScatterPlotChartConfig, ScatterPlotChartSettings} from './schema';
import {titleFromDescription} from '../../../chart-builders/chartTypeUtils';
import {ScatterPlotSettingsComponent} from './ScatterPlotSettings';
import {createScatterPlotAiTool} from './tool';
import {Workflow} from 'lucide-react';
import {createScatterPlotSpec} from './spec';
import {DEFAULT_CHART_MAX_DATA_POINTS} from '../../../chart-runtime';

const DESCRIPTION = 'Create a scatter plot chart';

export const scatterPlotChartType: SpecChartTypeDefinition<ScatterPlotChartConfig> =
  {
    id: 'scatter-plot',
    label: 'Scatter Plot',
    description: DESCRIPTION,
    icon: Workflow,
    schema: ScatterPlotChartSettings,
    settingsComponent: ScatterPlotSettingsComponent,
    buildTitle: titleFromDescription(DESCRIPTION),
    createTool: createScatterPlotAiTool,
    getDataPolicy: () => ({
      maxRows: DEFAULT_CHART_MAX_DATA_POINTS,
      reason:
        'Scatter charts render one point per row. Use a heatmap or another aggregated chart for larger datasets.',
    }),
    createSpec: createScatterPlotSpec,
  };
