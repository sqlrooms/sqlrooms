import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from '../../chart-builders/types';
import type {BoxPlotChartSettings} from './schema';
import {
  buildDefaultChartTitle,
  NUMERIC_COLUMN_TYPES,
} from '../../chart-builders/constants';

const FG_COLOR = 'var(--color-chart-1)';

function titleFromDescription(description: string) {
  return (fieldValues: Record<string, string>) =>
    buildDefaultChartTitle(description, fieldValues);
}

export const boxPlotChartType: ChartTypeDefinition<BoxPlotChartSettings> = {
  id: 'box-plot',
  label: 'Box Plot',
  description: 'Create a box plot',
  aiDescription:
    'Use for comparing the distribution of a numeric measure across categories.',
  fields: [
    {
      key: 'x',
      label: 'X Field (categorical)',
      required: true,
      description: 'Grouping field that defines the categories.',
    },
    {
      key: 'y',
      label: 'Y Field (numeric)',
      required: true,
      types: [...NUMERIC_COLUMN_TYPES],
      description: 'Numeric measure summarized within each category.',
    },
  ],
  buildTitle: titleFromDescription('Create a box plot'),
  createSpec: (tableName, {x, y}): Spec =>
    ({
      plot: [
        {
          mark: 'boxY',
          data: {from: tableName, filterBy: '$brush'},
          x,
          y,
          fill: FG_COLOR,
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
