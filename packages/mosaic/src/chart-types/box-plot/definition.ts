import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from '../base-types';
import {BoxPlotChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {BoxPlotSettingsComponent} from './BoxPlotSettings';
import {SpecGenerationError} from '../errors';

const FG_COLOR = 'var(--color-chart-1)';
const DESCRIPTION = 'Create a box plot';

export const boxPlotChartType: ChartTypeDefinition<BoxPlotChartSettings> = {
  id: 'box-plot',
  label: 'Box Plot',
  description: DESCRIPTION,
  aiDescription:
    'Use for comparing the distribution of a numeric measure across categories.',
  schema: BoxPlotChartSettings,
  settingsComponent: BoxPlotSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  createSpec: (tableName, {x, y}): Spec => {
    if (!x) {
      throw new SpecGenerationError('X field is required for box plot');
    }
    if (!y) {
      throw new SpecGenerationError('Y field is required for box plot');
    }
    return {
      plot: [
        {
          mark: 'boxY',
          data: {from: tableName, filterBy: '$brush'},
          x,
          y,
          fill: FG_COLOR,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: x,
      yLabel: y,
      height: 250,
      width: 380,
      margins: {left: 50, right: 20, top: 20, bottom: 50},
      params: {brush: {select: 'crossfilter'}},
    } as Spec;
  },
};
