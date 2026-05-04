import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from '../../chart-builders/types';
import type {BubbleChartSettings} from './schema';
import {
  buildDefaultChartTitle,
  NUMERIC_COLUMN_TYPES,
} from '../../chart-builders/constants';

const FG_COLOR = 'var(--color-chart-1)';

function titleFromDescription(description: string) {
  return (fieldValues: Record<string, string>) =>
    buildDefaultChartTitle(description, fieldValues);
}

export const bubbleChartChartType: ChartTypeDefinition<BubbleChartSettings> = {
  id: 'bubble-chart',
  label: 'Bubble Chart',
  description: 'Create a bubble chart',
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
  buildTitle: titleFromDescription('Create a bubble chart'),
  createSpec: (tableName, {x, y}): Spec =>
    ({
      plot: [
        {
          mark: 'dot',
          data: {from: tableName, filterBy: '$brush'},
          x,
          y,
          fill: FG_COLOR,
          fillOpacity: 0.5,
          r: 3,
        },
        {select: 'intervalXY', as: '$brush'},
      ],
      xLabel: x,
      yLabel: y,
      height: 250,
      width: 380,
      margins: {left: 50, right: 20, top: 20, bottom: 50},
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};
