import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from '../base-types';
import type {EcdfChartSettings} from './schema';
import {
  buildDefaultChartTitle,
  QUANTITATIVE_COLUMN_TYPES,
} from '../../chart-builders/constants';

const FG_COLOR = 'var(--color-chart-1)';

function titleFromDescription(description: string) {
  return (fieldValues: Record<string, string>) =>
    buildDefaultChartTitle(description, fieldValues);
}

export const ecdfChartType: ChartTypeDefinition<EcdfChartSettings> = {
  id: 'ecdf',
  label: 'eCDF',
  description: 'Create an eCDF chart of a field',
  aiDescription:
    'Use for a cumulative distribution curve over one numeric or temporal column.',
  fields: [
    {
      key: 'field',
      label: 'Field',
      required: true,
      types: [...QUANTITATIVE_COLUMN_TYPES],
      description:
        'Numeric or temporal column used to build the cumulative distribution.',
    },
  ],
  buildTitle: titleFromDescription('Create an eCDF chart of a field'),
  createSpec: (tableName, {field}): Spec =>
    ({
      plot: [
        {
          mark: 'areaY',
          data: {from: tableName, filterBy: '$brush'},
          x: field,
          y: {sum: field, cumulative: true},
          fill: FG_COLOR,
          fillOpacity: 0.3,
        },
        {
          mark: 'lineY',
          data: {from: tableName, filterBy: '$brush'},
          x: field,
          y: {sum: field, cumulative: true},
          stroke: FG_COLOR,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: field,
      yLabel: 'Cumulative',
      height: 250,
      width: 380,
      margins: {left: 50, right: 20, top: 20, bottom: 50},
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};
