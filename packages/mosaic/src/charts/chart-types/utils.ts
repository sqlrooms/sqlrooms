import {ChartTypeDefinition} from './base-types';

export function getChartToolName(
  chartType: ChartTypeDefinition<any>,
  toolNamePrefix: string,
): string {
  return `${toolNamePrefix}${chartType.id.replace(/-/g, '_')}`;
}
