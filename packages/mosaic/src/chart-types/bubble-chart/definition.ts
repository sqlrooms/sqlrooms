import type {ChartTypeDefinition} from '../base-types';
import {BubbleChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {BubbleChartSettingsComponent} from './BubbleChartSettings';
import {createBubbleChartAiTool} from './tool';
import {createBubbleChartSpec} from './spec';

const DESCRIPTION = 'Create a bubble chart';

export const bubbleChartChartType: ChartTypeDefinition<BubbleChartSettings> = {
  id: 'bubble-chart',
  label: 'Bubble Chart',
  description: DESCRIPTION,
  aiDescription: 'Use for a simple scatterplot of two numeric columns.',
  schema: BubbleChartSettings,
  settingsComponent: BubbleChartSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  createTool: createBubbleChartAiTool,
  createSpec: createBubbleChartSpec,
};
