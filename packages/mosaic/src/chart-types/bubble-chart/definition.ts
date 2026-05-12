import type {ChartTypeDefinition} from '../base-types';
import {BubbleChartConfig, BubbleChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {BubbleChartRenderer} from './BubbleChartRenderer';
import {BubbleChartSettingsComponent} from './BubbleChartSettings';
import {createBubbleChartAiTool} from './tool';
import {Workflow} from 'lucide-react';

const DESCRIPTION = 'Create a bubble chart';

export const bubbleChartChartType: ChartTypeDefinition<BubbleChartConfig> = {
  id: 'bubble-chart',
  label: 'Bubble Chart',
  description: DESCRIPTION,
  aiDescription: 'Use for a simple scatterplot of two numeric columns.',
  icon: Workflow,
  schema: BubbleChartSettings,
  settingsComponent: BubbleChartSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  renderer: BubbleChartRenderer,
  createTool: createBubbleChartAiTool,
};
