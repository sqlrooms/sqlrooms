import type {ChartTypeDefinition} from '../base-types';
import type {LineChartSettings} from './schema';
import {
  QUANTITATIVE_COLUMN_TYPES,
  NUMERIC_COLUMN_TYPES,
} from '../../chart-builders/constants';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {LineChartRenderer} from './LineChartRenderer';

const DESCRIPTION = 'Create a line chart of two fields';

export const lineChartChartType: ChartTypeDefinition<LineChartSettings> = {
  id: 'line-chart',
  label: 'Line Chart',
  description: DESCRIPTION,
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
  buildTitle: titleFromDescription(DESCRIPTION),
  renderer: LineChartRenderer,
};
