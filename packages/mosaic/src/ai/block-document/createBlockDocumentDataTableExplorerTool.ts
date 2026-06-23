import type {Tool} from 'ai';
import type {
  BlockDocumentAiAdapter,
  BlockDocumentStatefulBlockBlock,
} from '@sqlrooms/documents';
import {createDataTableExplorerTool} from '../createDataTableExplorerTool';
import type {DatabaseAiAdapter} from '../database-types';

/**
 * Parameters for creating a Mosaic data-table explorer block-document tool.
 */
export type CreateBlockDocumentDataTableExplorerToolParams = {
  /** Database adapter for table validation and column information. */
  databaseAdapter: DatabaseAiAdapter;
  /** Adapter for block document operations. */
  blockDocumentAdapter: BlockDocumentAiAdapter;
  /** ID of the block document where data-table explorer blocks will be added. */
  blockDocumentId: string;
  /** Host callback that performs the full durable block creation. */
  addDataTableExplorerBlock?: (params: {
    title: string;
    tableName: string;
    intent?: string;
  }) => Promise<unknown>;
  /** Host callback that creates the data-table explorer stateful block. */
  createDataTableExplorerBlock: (params: {
    title: string;
    tableName: string;
    intent?: string;
  }) =>
    | BlockDocumentStatefulBlockBlock
    | Promise<BlockDocumentStatefulBlockBlock>;
};

/**
 * Creates an AI tool for adding Mosaic data-table explorer blocks to a block
 * document.
 */
export function createBlockDocumentDataTableExplorerTool({
  blockDocumentAdapter,
  databaseAdapter,
  blockDocumentId,
  addDataTableExplorerBlock,
  createDataTableExplorerBlock,
}: CreateBlockDocumentDataTableExplorerToolParams): Tool {
  return createDataTableExplorerTool({
    databaseAdapter,
    addDataTable: async ({title, tableName, intent}) => {
      if (!tableName) {
        throw new Error(
          'Table name is required to add a data table explorer block',
        );
      }

      blockDocumentAdapter.ensureBlockDocument(blockDocumentId);
      if (addDataTableExplorerBlock) {
        return await addDataTableExplorerBlock({
          title: title ?? 'Data Table Explorer',
          tableName,
          intent,
        });
      }

      await blockDocumentAdapter.addBlock(
        blockDocumentId,
        await createDataTableExplorerBlock({
          title: title ?? 'Data Table Explorer',
          tableName,
          intent,
        }),
      );
    },
  });
}
