import {useMemo} from 'react';
import {type DataTable} from '@sqlrooms/db';
import {useStoreWithMosaicDashboard} from '../dashboard/MosaicDashboardSlice';

/**
 * Returns all tables that have columns defined.
 * Filters out tables without columns or with empty column arrays.
 *
 * @returns Array of tables with columns
 */
export function useTablesWithColumns(): DataTable[] {
  const tables = useStoreWithMosaicDashboard((state) => state.db.tables);

  return useMemo(
    () => tables.filter((table) => table.columns && table.columns.length > 0),
    [tables],
  );
}
