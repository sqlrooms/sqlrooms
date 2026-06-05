import {useMemo} from 'react';
import type {Selection} from '@uwdata/mosaic-core';
import type {DataTableExplorerStoreState} from '../createDataTableExplorerStore';
import type {
  DataTableExplorerPaginationState,
  DataTableExplorerSorting,
} from '../types';
import {
  buildDataTableExplorerBaseQuery,
  buildDataTableExplorerPageQuery,
} from '../utils';

export type UseDataTableExplorerQueryStateOptions = {
  pagination: DataTableExplorerPaginationState;
  rowSelectionVersion: number;
  schema: DataTableExplorerStoreState['schema'];
  selection: Selection;
  selectionVersion: number;
  sorting: DataTableExplorerSorting;
  tableName: string;
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
 */
export function useDataTableExplorerQueryState({
  pagination,
  rowSelectionVersion,
  schema,
  selection,
  selectionVersion,
  sorting,
  tableName,
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
        tableName,
      }),
    [fieldNames, filter, sorting, tableName],
  );
  const pageBaseQuery = useMemo(
    () =>
      buildDataTableExplorerBaseQuery({
        columns: fieldNames,
        filter: rowFilter,
        sorting,
        tableName,
      }),
    [fieldNames, rowFilter, sorting, tableName],
  );

  return {
    baseQuery,
    datasetId: [tableName, ...fieldNames].join(''),
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
