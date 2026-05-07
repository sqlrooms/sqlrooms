import {useMemo} from 'react';
import {useStoreWithMosaicDashboard} from '../MosaicDashboardSlice';
import {TableColumn} from '@sqlrooms/db';

export function useTableColumns(tableName?: string): TableColumn[] {
  const tables = useStoreWithMosaicDashboard((state) => state.db.tables);

  return useMemo(() => {
    if (!tableName) return [];
    const resolvedTable = tables.find((t) => t.table.table === tableName);
    return resolvedTable?.columns || [];
  }, [tableName, tables]);
}
