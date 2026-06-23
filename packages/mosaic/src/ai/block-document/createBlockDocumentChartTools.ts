import type {Tool} from 'ai';
import {
  createDefaultBlockDocumentBlockId,
  type BlockDocumentAiAdapter,
} from '@sqlrooms/documents';
import {createChartTools} from '../../charts/chart-types/createChartTools';
import type {ChartToolParams} from '../../charts/chart-types/tool-types';
import type {DatabaseAiAdapter} from '../database-types';
import type {ChartToolsOptions} from '../types';
import {DEFAULT_CHART_MAX_DATA_POINTS} from '../constants';
import {resolveChartTypes} from '../../charts/chart-types/resolveChartTypes';
import {BLOCK_DOCUMENT_CHART_TOOL_PREFIX} from './constants';

/**
 * Parameters for creating Mosaic chart tools that append chart blocks to a
 * block document.
 */
export type CreateBlockDocumentChartToolsParams = {
  databaseAdapter: DatabaseAiAdapter;
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
  chartToolsOptions?: ChartToolsOptions;
};

/**
 * Creates AI tools for generating Mosaic chart blocks in a block document.
 */
export function createBlockDocumentChartTools({
  databaseAdapter,
  blockDocumentAdapter,
  blockDocumentId,
  chartToolsOptions,
}: CreateBlockDocumentChartToolsParams): Record<string, Tool> {
  const resolvedChartTypes = resolveChartTypes(chartToolsOptions?.chartTypes);

  const chartToolParams: ChartToolParams = {
    maxDataPoints:
      chartToolsOptions?.chartMaxDataPoints ?? DEFAULT_CHART_MAX_DATA_POINTS,
    databaseAdapter,
    addChart: ({config, tableName, title}) => {
      if (!tableName) {
        throw new Error(
          'tableName is required for block document chart blocks but was empty or undefined',
        );
      }

      return blockDocumentAdapter.addBlock(blockDocumentId, {
        type: 'chart',
        id: createDefaultBlockDocumentBlockId(),
        config,
        tableName,
        caption: title ?? 'Chart',
      });
    },
  };

  return createChartTools(
    resolvedChartTypes,
    chartToolParams,
    BLOCK_DOCUMENT_CHART_TOOL_PREFIX,
  );
}
