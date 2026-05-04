import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from '../../chart-builders/types';
import type {LineChartSettings} from './schema';
import {
  buildDefaultChartTitle,
  QUANTITATIVE_COLUMN_TYPES,
  NUMERIC_COLUMN_TYPES,
} from '../../chart-builders/constants';

const FG_COLOR = 'var(--color-chart-1)';

function titleFromDescription(description: string) {
  return (fieldValues: Record<string, string>) =>
    buildDefaultChartTitle(description, fieldValues);
}

export const lineChartChartType: ChartTypeDefinition<LineChartSettings> = {
  id: 'line-chart',
  label: 'Line Chart',
  description: 'Create a line chart of two fields',
  aiDescription:
    'Use for trends over an ordered x-axis, typically time on x and a numeric measure on y.',
  fields: [
    {
      key: 'x',
      label: 'X Field',
      required: true,
      types: [...QUANTITATIVE_COLUMN_TYPES],
      description:
        'Ordered x-axis column, usually time or a quantitative value.',
    },
    {
      key: 'y',
      label: 'Y Field',
      required: true,
      types: [...NUMERIC_COLUMN_TYPES],
      description: 'Numeric measure plotted on the y-axis.',
    },
  ],
  buildTitle: titleFromDescription('Create a line chart of two fields'),
  createSpec: (tableName, {x, y}): Spec =>
    ({
      plot: [
        {
          mark: 'lineY',
          data: {from: tableName, filterBy: '$brush'},
          x,
          y,
          stroke: FG_COLOR,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: x,
      yLabel: y,
      height: 250,
      width: 380,
      margins: {left: 50, right: 20, top: 20, bottom: 50},
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};
