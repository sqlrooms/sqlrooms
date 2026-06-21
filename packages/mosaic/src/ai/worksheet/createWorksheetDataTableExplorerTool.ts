import type {Tool} from 'ai';
import {createDataTableExplorerTool} from '../createDataTableExplorerTool';

import {DatabaseAiAdapter} from '../database-types';
import {WorksheetAiAdapter} from './worksheet-types';

/**
 * Parameters for creating a worksheet data table explorer tool.
 * Provides the necessary adapters and context for adding data table explorer blocks to worksheets.
 */
export type CreateWorksheetDataTableExplorerToolParams = {
  /** Database adapter for table validation and column information */
  databaseAdapter: DatabaseAiAdapter;
  /** Worksheet adapter for adding data table explorer blocks */
  worksheetAdapter: WorksheetAiAdapter;
  /** ID of the worksheet where data table explorer blocks will be added */
  worksheetId: string;
};

/**
 * Creates an AI tool for adding data table explorer blocks to worksheets.
 * Data table explorers provide tabular views of datasets with column summaries and statistics.
 *
 * @param params - Parameters containing adapters and worksheet context
 * @returns Tool instance for creating data table explorer blocks in worksheets
 */
export function createWorksheetDataTableExplorerTool({
  worksheetAdapter,
  databaseAdapter,
  worksheetId,
}: CreateWorksheetDataTableExplorerToolParams): Tool {
  return createDataTableExplorerTool({
    databaseAdapter,
    addDataTable: ({title, tableName, intent}) => {
      if (!tableName) {
        throw new Error(
          'Table name is required to add a data table explorer block',
        );
      }

      worksheetAdapter.addDataTableExplorerBlock(
        worksheetId,
        title,
        tableName,
        intent,
      );
    },
  });
}
