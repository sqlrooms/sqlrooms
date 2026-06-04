import {useMemo} from 'react';
import {type DataTable} from '@sqlrooms/db';
import {useStoreWithMosaicDashboard} from './MosaicDashboardSlice';
import {useTablesWithColumns} from '../hooks/useTablesWithColumns';

/**
 * Returns the last selected table for a dashboard if it exists,
 * otherwise falls back to the first table with columns.
 *
 * @param dashboardId - The dashboard ID
 * @returns The selected table, or the first table, or undefined if no tables exist
 */
export function useSelectedOrFirstTable(
  dashboardId: string,
): DataTable | undefined {
  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const tables = useTablesWithColumns();

  return useMemo(() => {
    const lastSelectedTableName = dashboard?.lastSelectedTable;

    if (!lastSelectedTableName) {
      return tables[0];
    }

    // Try to find the last selected table first
    const lastSelectedTable = tables.find(
      (table) => table.table.table === lastSelectedTableName,
    );
    // Fall back to the first table if the selected one doesn't exist
    return lastSelectedTable ?? tables[0];
  }, [dashboard?.lastSelectedTable, tables]);
}
