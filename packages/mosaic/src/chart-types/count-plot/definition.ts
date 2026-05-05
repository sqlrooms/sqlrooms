import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from '../base-types';
import type {CountPlotChartSettings} from './schema';
import {
  buildDefaultChartTitle,
  QUANTITATIVE_COLUMN_TYPES,
} from '../../chart-builders/constants';

const BG_COLOR = 'var(--color-chart-overlay)';
const FG_COLOR = 'var(--color-chart-1)';

function titleFromDescription(description: string) {
  return (fieldValues: Record<string, string>) =>
    buildDefaultChartTitle(description, fieldValues);
}

export const countPlotChartType: ChartTypeDefinition<CountPlotChartSettings> = {
  id: 'count-plot',
  label: 'Count Plot',
  description: 'Create a count plot of a field',
  aiDescription:
    'Use for a quick binned distribution of one numeric or temporal column.',
  fields: [
    {
      key: 'field',
      label: 'Field',
      required: true,
      types: [...QUANTITATIVE_COLUMN_TYPES],
      description: 'Numeric or temporal column to bin along the x-axis.',
    },
  ],
  buildTitle: titleFromDescription('Create a count plot of a field'),
  createSpec: (tableName, {field}): Spec =>
    ({
      plot: [
        {
          mark: 'rectY',
          data: {from: tableName},
          x: {bin: field, maxbins: 25},
          y: {count: null},
          fill: BG_COLOR,
          inset: 0.5,
        },
        {
          mark: 'rectY',
          data: {from: tableName, filterBy: '$brush'},
          x: {bin: field, maxbins: 25},
          y: {count: null},
          fill: FG_COLOR,
          inset: 0.5,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: field,
      yLabel: null,
      yAxis: null,
      height: 200,
      width: 380,
      margins: {left: 50, right: 20, top: 20, bottom: 50},
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};
