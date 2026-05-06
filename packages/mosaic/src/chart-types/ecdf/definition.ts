import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from '../base-types';
import {EcdfChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';
import {EcdfSettingsComponent} from './EcdfSettings';

const FG_COLOR = 'var(--color-chart-1)';
const DESCRIPTION = 'Create an eCDF chart of a field';

export const ecdfChartType: ChartTypeDefinition<EcdfChartSettings> = {
  id: 'ecdf',
  label: 'eCDF',
  description: DESCRIPTION,
  aiDescription:
    'Use for a cumulative distribution curve over one numeric or temporal column.',
  schema: EcdfChartSettings,
  settingsComponent: EcdfSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  createSpec: (tableName, {field}): Spec =>
    ({
      plot: [
        {
          mark: 'areaY',
          data: {from: tableName, filterBy: '$brush'},
          x: field,
          y: {sum: field, cumulative: true},
          fill: FG_COLOR,
          fillOpacity: 0.3,
        },
        {
          mark: 'lineY',
          data: {from: tableName, filterBy: '$brush'},
          x: field,
          y: {sum: field, cumulative: true},
          stroke: FG_COLOR,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: field,
      yLabel: 'Cumulative',
      height: 250,
      width: 380,
      margins: {left: 50, right: 20, top: 20, bottom: 50},
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};
