import {ChartTypeDefinition} from './base-types';
import {createDefaultChartTypes} from './createDefaultChartTypes';

export function resolveChartTypes(
  chartTypes: ChartTypeDefinition<any>[] | undefined,
): ChartTypeDefinition<any>[] {
  if (chartTypes === undefined) {
    return createDefaultChartTypes({includeCustomSpec: false});
  }

  return chartTypes;
}
