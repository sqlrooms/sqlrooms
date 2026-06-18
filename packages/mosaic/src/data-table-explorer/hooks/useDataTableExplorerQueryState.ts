import {useMemo} from 'react';
import type {Selection} from '@uwdata/mosaic-core';
import type {DataTableExplorerStoreState} from '../createDataTableExplorerStore';
import type {
  DataTableExplorerPaginationState,
  DataTableExplorerSqlTableReference,
  DataTableExplorerSorting,
} from '../types';
import {
  buildDataTableExplorerBaseQuery,
  buildDataTableExplorerPageQuery,
} from '../utils';

/**
 * Inputs used to derive memoized query state for a dataTableExplorer instance.
 */
export type UseDataTableExplorerQueryStateOptions = {
  pagination: DataTableExplorerPaginationState;
  rowSelectionVersion: number;
  schema: DataTableExplorerStoreState['schema'];
  selection: Selection;
  selectionVersion: number;
  sorting: DataTableExplorerSorting;
  /**
   * Stable SQLRooms table identity used to build dataset IDs and distinguish
   * tables that share schema/table names across catalogs.
   */
  tableIdentity: string;
  /**
   * Mosaic SQL table reference used in generated queries.
   */
  tableReference: DataTableExplorerSqlTableReference;
};

export type UseDataTableExplorerQueryStateReturn = {
  baseQuery: ReturnType<typeof buildDataTableExplorerBaseQuery>;
  datasetId: string;
  fieldNames: string[];
  fields: DataTableExplorerStoreState['schema']['fields'];
  hasFilters: boolean;
  pageQuery: string;
  rowFilter: ReturnType<Selection['predicate']>;
};

/**
 * Derives the dataTableExplorer's field and SQL state from the current schema,
 * selection, sorting, and pagination state.
 *
 * @param options Current schema, selection, pagination, sorting, and table
 * reference inputs for query generation.
 */
export function useDataTableExplorerQueryState({
  pagination,
  rowSelectionVersion,
  schema,
  selection,
  selectionVersion,
  sorting,
  tableIdentity,
  tableReference,
}: UseDataTableExplorerQueryStateOptions): UseDataTableExplorerQueryStateReturn {
  const fields = schema.fields;
  const fieldNames = useMemo(() => fields.map((field) => field.name), [fields]);
  const filter = useMemo(() => {
    void selectionVersion;
    return selection.predicate();
  }, [selection, selectionVersion]);
  const rowFilter = useMemo(() => {
    void rowSelectionVersion;
    return selection.predicate();
  }, [rowSelectionVersion, selection]);
  const baseQuery = useMemo(
    () =>
      buildDataTableExplorerBaseQuery({
        columns: fieldNames,
        filter,
        sorting,
        tableName: tableReference,
      }),
    [fieldNames, filter, sorting, tableReference],
  );
  const pageBaseQuery = useMemo(
    () =>
      buildDataTableExplorerBaseQuery({
        columns: fieldNames,
        filter: rowFilter,
        sorting,
        tableName: tableReference,
      }),
    [fieldNames, rowFilter, sorting, tableReference],
  );

  return {
    baseQuery,
    datasetId: [tableIdentity, ...fieldNames].join(''),
    fieldNames,
    fields,
    hasFilters: Array.isArray(filter) ? filter.length > 0 : Boolean(filter),
    pageQuery: buildDataTableExplorerPageQuery(
      pageBaseQuery,
      pagination,
    ).toString(),
    rowFilter,
  };
}
