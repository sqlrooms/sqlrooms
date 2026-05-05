import type {ChartTypeDefinition} from '../base-types';
import type {BoxPlotChartSettings} from './schema';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/constants';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';

const DESCRIPTION = 'Create a box plot';
const MOSAIC_DASHBOARD_BOXPLOT_PANEL_TYPE = 'boxplot';

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
  outputKind: 'dashboard-panel',
  createOutput: (tableName, {x, y}) => ({
    kind: 'dashboard-panel',
    type: MOSAIC_DASHBOARD_BOXPLOT_PANEL_TYPE,
    source: {tableName},
    config: {x, y},
  }),
};
