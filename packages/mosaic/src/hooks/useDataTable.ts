import type {DataTable} from '@sqlrooms/db';
import {useMemo} from 'react';
import {findTableByName} from '../utils/table-lookup';
import {useTablesWithColumns} from './useTablesWithColumns';

export function useDataTable(
  tableName: string | undefined,
): DataTable | undefined {
  const tables = useTablesWithColumns();

  return useMemo(() => findTableByName(tables, tableName), [tables, tableName]);
}
