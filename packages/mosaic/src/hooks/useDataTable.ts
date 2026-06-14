import type {DataTable} from '@sqlrooms/db';
import {useStoreWithMosaicDashboard} from '../dashboard/MosaicDashboardSlice';

export function useDataTable(
  tableName: string | undefined,
): DataTable | undefined {
  return useStoreWithMosaicDashboard((state) => {
    if (!tableName) {
      return undefined;
    }
    const table = state.db.findTableByName(tableName);
    return table?.columns.length ? table : undefined;
  });
}
