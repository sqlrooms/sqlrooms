import type {ChartTypeDefinition} from './base-types';
import {getChartToolName} from './utils';

export function createChartToolsInstructions(
  chartTypes: ChartTypeDefinition<any>[],
  toolNamePrefix: string,
): string {
  return chartTypes
    .filter((chartType) => chartType.createTool)
    .map((chartType) => {
      const toolName = getChartToolName(chartType, toolNamePrefix);
      const description = chartType.aiDescription;

      return `${toolName} - ${description}`;
    })
    .join('\n');
}
