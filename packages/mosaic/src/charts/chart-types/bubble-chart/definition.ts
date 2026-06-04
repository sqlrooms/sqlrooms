import type {SpecChartTypeDefinition} from '../base-types';
import {BubbleChartConfig, BubbleChartSettings} from './schema';
import {titleFromDescription} from '../../../chart-builders/chartTypeUtils';
import {BubbleChartSettingsComponent} from './BubbleChartSettings';
import {createBubbleChartAiTool} from './tool';
import {Workflow} from 'lucide-react';
import {createBubbleChartSpec} from './spec';
import {DEFAULT_CHART_MAX_DATA_POINTS} from '../../../chart-runtime';

const DESCRIPTION = 'Create a bubble chart';

export const bubbleChartChartType: SpecChartTypeDefinition<BubbleChartConfig> =
  {
    id: 'bubble-chart',
    label: 'Bubble Chart',
    description: DESCRIPTION,
    icon: Workflow,
    schema: BubbleChartSettings,
    settingsComponent: BubbleChartSettingsComponent,
    buildTitle: titleFromDescription(DESCRIPTION),
    createTool: createBubbleChartAiTool,
    getDataPolicy: () => ({
      maxRows: DEFAULT_CHART_MAX_DATA_POINTS,
      reason:
        'Bubble charts render one point per row. Use a heatmap or another aggregated chart for larger datasets.',
    }),
    createSpec: createBubbleChartSpec,
  };
