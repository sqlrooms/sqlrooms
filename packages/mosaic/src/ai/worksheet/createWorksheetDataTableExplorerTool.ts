import type {Tool} from 'ai';
import {createDataTableExplorerTool} from '../../charts/chart-types';

import {DatabaseAiAdapter} from '../database-types';
import {WorksheetAiAdapter} from './worksheet-types';

export type CreateWorksheetDataTableExplorerToolParams = {
  databaseAdapter: DatabaseAiAdapter;
  worksheetAdapter: WorksheetAiAdapter;
  worksheetId: string;
};

export function createWorksheetDataTableExplorerTool({
  worksheetAdapter,
  databaseAdapter,
  worksheetId,
}: CreateWorksheetDataTableExplorerToolParams): Tool {
  return createDataTableExplorerTool({
    databaseAdapter,
    addDataTable: ({title, tableName}) => {
      if (!tableName) {
        throw new Error(
          'Table name is required to add a data table explorer block',
        );
      }

      worksheetAdapter.addDataTableExplorerBlock(worksheetId, title, tableName);
    },
  });
}
