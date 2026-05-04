import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from '../../chart-builders/types';
import type {HeatmapChartSettings} from './schema';
import {
  buildDefaultChartTitle,
  NUMERIC_COLUMN_TYPES,
} from '../../chart-builders/chartTypeUtils';

function titleFromDescription(description: string) {
  return (fieldValues: Record<string, string>) =>
    buildDefaultChartTitle(description, fieldValues);
}

export const heatmapChartType: ChartTypeDefinition<HeatmapChartSettings> = {
  id: 'heatmap',
  label: 'Heatmap',
  description: 'Create a 2D heatmap of two fields',
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
  buildTitle: titleFromDescription('Create a 2D heatmap of two fields'),
  createSpec: (tableName, {x, y}): Spec =>
    ({
      plot: [
        {
          mark: 'raster',
          data: {from: tableName, filterBy: '$brush'},
          x,
          y,
          fill: 'density',
          bandwidth: 0,
          pixelSize: 3,
        },
        {select: 'intervalXY', as: '$brush'},
      ],
      colorScale: 'sqrt',
      colorScheme: 'ylorrd',
      xLabel: x,
      yLabel: y,
      height: 250,
      width: 380,
      margins: {left: 50, right: 20, top: 20, bottom: 50},
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};
