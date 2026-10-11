import {useMemo} from 'react';
import {type DataTable} from '@sqlrooms/db';
import {useStoreWithMosaicDashboard} from './MosaicDashboardSlice';
import {useTablesWithColumns} from '../hooks/useTablesWithColumns';
import {resolveMosaicTableReference} from '../mosaicTableReference';

/**
 * Returns the selected table for a dashboard if it exists,
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
    const selectedTableName =
      dashboard?.selectedTable ?? dashboard?.lastSelectedTable;

    if (!selectedTableName) {
      return tables[0];
    }

    const {table, ambiguousMatches} = resolveMosaicTableReference(
      tables,
      selectedTableName,
    );
    if (ambiguousMatches?.length) {
      return undefined;
    }

    return table ?? tables[0];
  }, [dashboard?.lastSelectedTable, dashboard?.selectedTable, tables]);
}
