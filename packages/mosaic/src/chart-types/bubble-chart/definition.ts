import type {SpecChartTypeDefinition} from '../base-types';
import {BubbleChartConfig, BubbleChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {BubbleChartSettingsComponent} from './BubbleChartSettings';
import {createBubbleChartAiTool} from './tool';
import {Workflow} from 'lucide-react';
import {createBubbleChartSpec} from './spec';
import {
  MAX_BUBBLE_CHART_DATA_POINTS,
  BUBBLE_CHART_DESCRIPTION,
} from './constants';

export const bubbleChartChartType: SpecChartTypeDefinition<BubbleChartConfig> =
  {
    id: 'bubble-chart',
    label: 'Bubble Chart',
    description: BUBBLE_CHART_DESCRIPTION,
    icon: Workflow,
    schema: BubbleChartSettings,
    settingsComponent: BubbleChartSettingsComponent,
    buildTitle: titleFromDescription(BUBBLE_CHART_DESCRIPTION),
    createTool: createBubbleChartAiTool,
    createSpec: createBubbleChartSpec,
    maxDataPoints: MAX_BUBBLE_CHART_DATA_POINTS,
  };
