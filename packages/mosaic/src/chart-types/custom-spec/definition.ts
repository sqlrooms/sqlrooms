import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from '../base-types';
import type {CustomSpecChartSettings} from './schema';
import {buildDefaultChartTitle} from '../../chart-builders/constants';

function titleFromDescription(description: string) {
  return (fieldValues: Record<string, string>) =>
    buildDefaultChartTitle(description, fieldValues);
}

export const customSpecChartType: ChartTypeDefinition<CustomSpecChartSettings> =
  {
    id: 'custom-spec',
    label: 'Custom Spec',
    description: 'Create a chart with custom spec',
    aiDescription:
      'Manual template for editing after creation. Prefer explicit chart templates for assistant-created charts.',
    fields: [],
    buildTitle: titleFromDescription('Create a chart with custom spec'),
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
