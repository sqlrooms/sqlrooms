import type {ChartTypeDefinition} from '../base-types';
import type {BubbleChartSettings} from './schema';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/constants';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {BubbleChartRenderer} from './BubbleChartRenderer';

const DESCRIPTION = 'Create a bubble chart';

export const bubbleChartChartType: ChartTypeDefinition<BubbleChartSettings> = {
  id: 'bubble-chart',
  label: 'Bubble Chart',
  description: DESCRIPTION,
  aiDescription: 'Use for a simple scatterplot of two numeric columns.',
  fields: [
    {
      key: 'x',
      label: 'X Field',
      required: true,
      types: [...NUMERIC_COLUMN_TYPES],
      description: 'Numeric column used on the x-axis.',
    },
    {
      key: 'y',
      label: 'Y Field',
      required: true,
      types: [...NUMERIC_COLUMN_TYPES],
      description: 'Numeric column used on the y-axis.',
    },
  ],
  buildTitle: titleFromDescription(DESCRIPTION),
  renderer: BubbleChartRenderer,
};
