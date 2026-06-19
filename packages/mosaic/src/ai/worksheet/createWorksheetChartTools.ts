import type {Tool} from 'ai';
import {createChartTools} from '../../charts/chart-types/createChartTools';
import {createDefaultBlockDocumentBlockId} from '@sqlrooms/documents';
import type {WorksheetAiAdapter} from './worksheet-types';
import {ChartToolParams} from '../../charts/chart-types/tool-types';
import {DatabaseAiAdapter} from '../database-types';
import {ChartToolsOptions} from '../types';
import {DEFAULT_CHART_MAX_DATA_POINTS} from '../constants';
import {resolveChartTypes} from '../../charts/chart-types/resolveChartTypes';
import {WORKSHEET_CHART_TOOL_PREFIX} from './constants';

export type CreateWorksheetChartToolsParams = {
  databaseAdapter: DatabaseAiAdapter;
  worksheetAdapter: WorksheetAiAdapter;
  worksheetId: string;
  chartToolsOptions?: ChartToolsOptions;
};

export function createWorksheetChartTools({
  databaseAdapter,
  worksheetAdapter,
  worksheetId,
  chartToolsOptions,
}: CreateWorksheetChartToolsParams): Record<string, Tool> {
  const resolvedChartTypes = resolveChartTypes(chartToolsOptions?.chartTypes);

  const chartToolParams: ChartToolParams = {
    maxDataPoints:
      chartToolsOptions?.chartMaxDataPoints ?? DEFAULT_CHART_MAX_DATA_POINTS,
    databaseAdapter: databaseAdapter,
    addChart: ({config, tableName, title}) => {
      if (!tableName) {
        throw new Error(
          'tableName is required for worksheet chart blocks but was empty or undefined',
        );
      }

      return worksheetAdapter.addBlock(worksheetId, {
        type: 'chart',
        id: createDefaultBlockDocumentBlockId(),
        config,
        tableName,
        caption: title,
      });
    },
  };

  return createChartTools(
    resolvedChartTypes,
    chartToolParams,
    WORKSHEET_CHART_TOOL_PREFIX,
  );
}
