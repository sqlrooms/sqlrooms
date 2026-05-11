import type {ChartTypeDefinition} from '../base-types';
import type {HistogramChartSettings} from './schema';
import {QUANTITATIVE_COLUMN_TYPES} from '../../chart-builders/constants';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {HistogramRenderer} from './HistogramRenderer';

const DESCRIPTION = 'Create a histogram of a field';

export const histogramChartType: ChartTypeDefinition<HistogramChartSettings> = {
  id: 'histogram',
  label: 'Histogram',
  description: DESCRIPTION,
  aiDescription:
    'Use for the distribution of one numeric or temporal column with count on the y-axis.',
  fields: [
    {
      key: 'field',
      label: 'Field',
      required: true,
      types: [...QUANTITATIVE_COLUMN_TYPES],
      description: 'Numeric or temporal column to bin into histogram buckets.',
    },
  ],
  buildTitle: titleFromDescription(DESCRIPTION),
  renderer: HistogramRenderer,
};
