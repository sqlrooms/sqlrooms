import type {SpecChartTypeDefinition} from '../base-types';
import {BubbleChartConfig, BubbleChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {BubbleChartSettingsComponent} from './BubbleChartSettings';
import {createBubbleChartAiTool} from './tool';
import {Workflow} from 'lucide-react';
import {createBubbleChartSpec} from './spec';

const DESCRIPTION = 'Create a bubble chart';

export const bubbleChartChartType: SpecChartTypeDefinition<BubbleChartConfig> =
  {
    id: 'bubble-chart',
    label: 'Bubble Chart',
    description: DESCRIPTION,
    aiDescription: 'Use for a simple scatterplot of two numeric columns.',
    icon: Workflow,
    schema: BubbleChartSettings,
    settingsComponent: BubbleChartSettingsComponent,
    buildTitle: titleFromDescription(DESCRIPTION),
    createTool: createBubbleChartAiTool,
    createSpec: createBubbleChartSpec,
  };
