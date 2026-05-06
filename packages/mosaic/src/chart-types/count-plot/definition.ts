import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from '../base-types';
import {CountPlotChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {CountPlotSettingsComponent} from './CountPlotSettings';

const BG_COLOR = 'var(--color-chart-overlay)';
const FG_COLOR = 'var(--color-chart-1)';
const DESCRIPTION = 'Create a count plot of a field';

export const countPlotChartType: ChartTypeDefinition<CountPlotChartSettings> = {
  id: 'count-plot',
  label: 'Count Plot',
  description: DESCRIPTION,
  aiDescription:
    'Use for a quick binned distribution of one numeric or temporal column.',
  schema: CountPlotChartSettings,
  settingsComponent: CountPlotSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  createSpec: (tableName, {field}): Spec =>
    ({
      plot: [
        {
          mark: 'rectY',
          data: {from: tableName},
          x: {bin: field, maxbins: 25},
          y: {count: null},
          fill: BG_COLOR,
          inset: 0.5,
        },
        {
          mark: 'rectY',
          data: {from: tableName, filterBy: '$brush'},
          x: {bin: field, maxbins: 25},
          y: {count: null},
          fill: FG_COLOR,
          inset: 0.5,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: field,
      yLabel: null,
      yAxis: null,
      height: 200,
      width: 380,
      margins: {left: 50, right: 20, top: 20, bottom: 50},
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};
