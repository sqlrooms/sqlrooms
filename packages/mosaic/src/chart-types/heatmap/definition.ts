import type {ChartTypeDefinition} from '../base-types';
import type {HeatmapChartSettings} from './schema';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/constants';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {HeatmapRenderer} from './HeatmapRenderer';

const DESCRIPTION = 'Create a 2D heatmap of two fields';

export const heatmapChartType: ChartTypeDefinition<HeatmapChartSettings> = {
  id: 'heatmap',
  label: 'Heatmap',
  description: DESCRIPTION,
  aiDescription:
    'Use for dense relationships between two numeric columns where point overlap would be high.',
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
  renderer: HeatmapRenderer,
};
