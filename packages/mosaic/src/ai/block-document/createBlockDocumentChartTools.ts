import type {Tool} from 'ai';
import {
  blockDocumentNodeToBlock,
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
 * Parameters for creating Mosaic chart tools that add or update chart blocks in
 * a block document.
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
    addChart: ({config, tableName, title, panelId}) => {
      if (!tableName) {
        throw new Error(
          'tableName is required for block document chart blocks but was empty or undefined',
        );
      }

      const resolvedTable = ensureTable(databaseAdapter, tableName);
      const tableIdentity = getTableIdentity(resolvedTable.table);
      const blockIdToUpdate = targetBlockId ?? panelId;

      if (blockIdToUpdate) {
        if (!blockDocumentAdapter.updateBlock) {
          throw new Error(
            'Block document chart block editing requires the host to provide updateBlock on the block document adapter.',
          );
        }

        const existingBlock = blockDocumentAdapter
          .getBlocks(blockDocumentId)
          ?.map((block) => blockDocumentNodeToBlock(block))
          .find((block) => block?.id === blockIdToUpdate);

        if (!existingBlock) {
          throw new Error(`Chart block "${blockIdToUpdate}" was not found.`);
        }

        if (existingBlock.type !== 'chart') {
          throw new Error(
            `Block "${blockIdToUpdate}" is not a chart block. Cannot update it with a chart tool.`,
          );
        }

        const caption = title ?? existingBlock.caption ?? 'Chart';

        const updateResult = blockDocumentAdapter.updateBlock(
          blockDocumentId,
          blockIdToUpdate,
          {
            type: 'chart',
            id: blockIdToUpdate,
            config,
            tableName: tableIdentity,
            caption,
          },
        );

        return updateResult &&
          typeof (updateResult as Promise<void>).then === 'function'
          ? (updateResult as Promise<void>).then(() => blockIdToUpdate)
          : blockIdToUpdate;
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
