import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from '../base-types';
import {HistogramChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {HistogramSettingsComponent} from './HistogramSettings';
import {SpecGenerationError} from '../errors';

const BG_COLOR = 'var(--color-chart-overlay)';
const FG_COLOR = 'var(--color-chart-1)';
const DESCRIPTION = 'Create a histogram of a field';

export const histogramChartType: ChartTypeDefinition<HistogramChartSettings> = {
  id: 'histogram',
  label: 'Histogram',
  description: DESCRIPTION,
  aiDescription:
    'Use for the distribution of one numeric or temporal column with count on the y-axis.',
  schema: HistogramChartSettings,
  settingsComponent: HistogramSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  createSpec: (tableName, {field}): Spec => {
    if (!field) {
      throw new SpecGenerationError('Field is required for histogram');
    }

    return {
      plot: [
        {
          mark: 'rectY',
          data: {from: tableName},
          x: {bin: field, maxbins: 40},
          y: {count: null},
          fill: BG_COLOR,
          inset: 0.5,
        },
        {
          mark: 'rectY',
          data: {from: tableName, filterBy: '$brush'},
          x: {bin: field, maxbins: 40},
          y: {count: null},
          fill: FG_COLOR,
          inset: 0.5,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: field,
      yLabel: 'Count',
      height: 200,
      width: 380,
      margins: {left: 50, right: 20, top: 20, bottom: 50},
      params: {brush: {select: 'crossfilter'}},
    } as Spec;
  },
};
