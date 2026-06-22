import type {Tool} from 'ai';
import {createDataTableExplorerTool} from '../createDataTableExplorerTool';
import {
  createDefaultBlockDocumentBlockId,
  type BlockDocumentAiAdapter,
  type BlockDocumentStatefulBlockBlock,
} from '@sqlrooms/documents';

import {DatabaseAiAdapter} from '../database-types';

/**
 * Parameters for creating a block document data table explorer tool.
 */
export type CreateBlockDocumentDataTableExplorerToolParams = {
  databaseAdapter: DatabaseAiAdapter;
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
};

/**
 * Creates an AI tool for adding data table explorer blocks to block documents.
 */
export function createBlockDocumentDataTableExplorerTool({
  blockDocumentAdapter,
  databaseAdapter,
  blockDocumentId,
}: CreateBlockDocumentDataTableExplorerToolParams): Tool {
  return createDataTableExplorerTool({
    databaseAdapter,
    addDataTable: ({title, tableName, intent}) => {
      if (!tableName) {
        throw new Error(
          'Table name is required to add a data table explorer block',
        );
      }

      const block: BlockDocumentStatefulBlockBlock = {
        type: 'statefulBlock',
        id: createDefaultBlockDocumentBlockId(),
        blockInstanceId: createDefaultBlockDocumentBlockId(),
        blockType: 'data-table',
        intent,
        title: tableName,
        caption: title,
      };

      blockDocumentAdapter.addBlock(blockDocumentId, block);
    },
  });
}
