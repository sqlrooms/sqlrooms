import {useMemo} from 'react';
import {useStoreWithMosaicDashboard} from '../MosaicDashboardSlice';
import {TableColumn} from '@sqlrooms/db';

export function useTableColumns(tableName?: string): TableColumn[] {
  const tables = useStoreWithMosaicDashboard((state) => state.db.tables);

  const resolvedTable = useMemo(() => {
    if (!tableName) return undefined;
    return tables.find((t) => t.table.table === tableName);
  }, [tableName, tables]);

  return resolvedTable?.columns || [];
}
