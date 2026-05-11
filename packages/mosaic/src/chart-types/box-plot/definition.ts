import type {ChartTypeDefinition} from '../base-types';
import type {BoxPlotChartSettings} from './schema';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/constants';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {BoxPlotPanelRenderer} from './BoxPlotPanelRenderer';

const DESCRIPTION = 'Create a box plot';

export const boxPlotChartType: ChartTypeDefinition<BoxPlotChartSettings> = {
  id: 'box-plot',
  label: 'Box Plot',
  description: DESCRIPTION,
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
  buildTitle: titleFromDescription(DESCRIPTION),
  renderer: BoxPlotPanelRenderer,
};
