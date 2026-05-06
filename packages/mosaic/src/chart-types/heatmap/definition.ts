import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from '../base-types';
import {HeatmapChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {HeatmapSettingsComponent} from './HeatmapSettings';

const DESCRIPTION = 'Create a 2D heatmap of two fields';

export const heatmapChartType: ChartTypeDefinition<HeatmapChartSettings> = {
  id: 'heatmap',
  label: 'Heatmap',
  description: DESCRIPTION,
  aiDescription:
    'Use for dense relationships between two numeric columns where point overlap would be high.',
  schema: HeatmapChartSettings,
  settingsComponent: HeatmapSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
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
