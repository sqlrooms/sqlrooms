import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from '../base-types';
import type {CustomSpecChartSettings} from './schema';
import {titleFromDescription} from '../../chart-builders/chartTypeUtils';

const DESCRIPTION = 'Create a chart with custom spec';

export const customSpecChartType: ChartTypeDefinition<CustomSpecChartSettings> =
  {
    id: 'custom-spec',
    label: 'Custom Spec',
    description: DESCRIPTION,
    aiDescription:
      'Manual template for editing after creation. Prefer explicit chart templates for assistant-created charts.',
    fields: [],
    buildTitle: titleFromDescription(DESCRIPTION),
    createSpec: (tableName): Spec =>
      ({
        plot: [
          {
            mark: 'rectY',
            data: {from: tableName, filterBy: '$brush'},
            x: {bin: 'field_name', maxbins: 25},
            y: {count: null},
            fill: 'steelblue',
            inset: 0.5,
          },
          {select: 'intervalX', as: '$brush'},
        ],
        xLabel: 'field_name',
        height: 200,
        width: 380,
        params: {brush: {select: 'crossfilter'}},
      }) as Spec,
  };
