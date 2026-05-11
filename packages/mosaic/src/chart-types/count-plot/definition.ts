import type {ChartTypeDefinition} from '../base-types';
import type {CountPlotChartSettings} from './schema';
import {QUANTITATIVE_COLUMN_TYPES} from '../../chart-builders/constants';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {CountPlotRenderer} from './CountPlotRenderer';

const DESCRIPTION = 'Create a count plot of a field';

export const countPlotChartType: ChartTypeDefinition<CountPlotChartSettings> = {
  id: 'count-plot',
  label: 'Count Plot',
  description: DESCRIPTION,
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
  buildTitle: titleFromDescription(DESCRIPTION),
  renderer: CountPlotRenderer,
};
