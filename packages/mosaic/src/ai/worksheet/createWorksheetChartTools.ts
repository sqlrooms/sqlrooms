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

/**
 * Parameters for creating worksheet chart tools.
 *
 * @property databaseAdapter - Adapter for database operations and table queries
 * @property worksheetAdapter - Adapter for worksheet-specific operations like adding blocks
 * @property worksheetId - ID of the target worksheet to add chart blocks to
 * @property chartToolsOptions - Optional configuration for chart types and data point limits
 */
export type CreateWorksheetChartToolsParams = {
  databaseAdapter: DatabaseAiAdapter;
  worksheetAdapter: WorksheetAiAdapter;
  worksheetId: string;
  chartToolsOptions?: ChartToolsOptions;
};

/**
 * Creates AI tools for generating chart blocks in worksheets.
 *
 * @param params - Configuration parameters for chart tool creation
 * @param params.databaseAdapter - Adapter for database operations
 * @param params.worksheetAdapter - Adapter for worksheet block management
 * @param params.worksheetId - Target worksheet ID
 * @param params.chartToolsOptions - Optional chart configuration options
 * @returns Record of chart tool names to Tool instances, prefixed with worksheet-specific identifiers
 */
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
