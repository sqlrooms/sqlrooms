import type {Tool} from 'ai';
import {createChartTools} from '../../charts/chart-types/createChartTools';
import {createDefaultChartTypes} from '../../charts/chart-types/createDefaultChartTypes';
import {createChartToolDeps} from '../createChartToolDeps';
import {createDefaultBlockDocumentBlockId} from '@sqlrooms/documents';
import type {CreateWorksheetAgentToolOptions} from './worksheet-types';

export function createWorksheetChartTools<TState>(
  options: CreateWorksheetAgentToolOptions<TState>,
  worksheetId: string,
): Record<string, Tool> {
  const resolvedChartTypes =
    options.chartTypes ?? createDefaultChartTypes({includeCustomSpec: false});

  const chartToolDeps = createChartToolDeps({
    adapter: options.adapter,
    addChart: ({config, tableName, title}) => {
      return options.adapter.addBlock(worksheetId, {
        type: 'chart',
        id: createDefaultBlockDocumentBlockId(),
        config,
        tableName,
        caption: title,
      });
    },
  });

  return createChartTools(
    resolvedChartTypes,
    chartToolDeps,
    'create_worksheet_block_', // Worksheet-specific prefix
  );
}
