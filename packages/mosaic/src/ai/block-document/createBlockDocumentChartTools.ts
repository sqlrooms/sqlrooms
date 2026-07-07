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
import {getTableIdentity} from '@sqlrooms/db';
import {ensureTable} from '../tool-helpers';

/**
 * Parameters for creating Mosaic chart tools that append chart blocks to a
 * block document.
 */
export type CreateBlockDocumentChartToolsParams = {
  databaseAdapter: DatabaseAiAdapter;
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
  targetBlockId?: string;
  chartToolsOptions?: ChartToolsOptions;
};

/**
 * Creates AI tools for generating Mosaic chart blocks in a block document.
 */
export function createBlockDocumentChartTools({
  databaseAdapter,
  blockDocumentAdapter,
  blockDocumentId,
  targetBlockId,
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

      const resolvedTable = ensureTable(databaseAdapter, tableName);
      const tableIdentity = getTableIdentity(resolvedTable.table);

      if (targetBlockId) {
        if (!blockDocumentAdapter.updateBlock) {
          throw new Error(
            'Block document chart block editing requires the host to provide updateBlock on the block document adapter.',
          );
        }

        const updateResult = blockDocumentAdapter.updateBlock(
          blockDocumentId,
          targetBlockId,
          {
            type: 'chart',
            id: targetBlockId,
            config,
            tableName: tableIdentity,
            caption: title ?? 'Chart',
          },
        );

        return updateResult &&
          typeof (updateResult as Promise<void>).then === 'function'
          ? (updateResult as Promise<void>).then(() => targetBlockId)
          : targetBlockId;
      }

      return blockDocumentAdapter.addBlock(blockDocumentId, {
        type: 'chart',
        id: createDefaultBlockDocumentBlockId(),
        config,
        tableName: tableIdentity,
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
