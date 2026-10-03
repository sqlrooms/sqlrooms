import type {QualifiedTableName} from '@sqlrooms/db';
import type {MosaicClient, Selection} from '@uwdata/mosaic-core';
import type {Interval1D} from '@uwdata/mosaic-plot';
import type {Field, Table} from 'apache-arrow';
import type {Dispatch, SetStateAction} from 'react';
import type {MosaicSqlTableReference} from '../mosaicTableReference';

export type DataTableExplorerSorting = Array<{id: string; desc: boolean}>;

export type DataTableExplorerPaginationState = {
  pageIndex: number;
  pageSize: number;
};

export type DataTableExplorerBinValue = number | Date;

export type DataTableExplorerBin = {
  x0: DataTableExplorerBinValue;
  x1: DataTableExplorerBinValue;
  length: number;
};

export type DataTableExplorerSummaryStatus = {
  error?: Error;
  isLoading: boolean;
};

export type DataTableExplorerHistogramSummary =
  DataTableExplorerSummaryStatus & {
    filteredBins: DataTableExplorerBin[];
    filteredNullCount: number;
    interactor: Interval1D | null;
    kind: 'histogram';
    totalBins: DataTableExplorerBin[];
    totalNullCount: number;
    valueType: 'date' | 'number';
  };

export type DataTableExplorerCategoryBucket = {
  filteredCount: number;
  key: string;
  kind: 'null' | 'overflow' | 'unique' | 'value';
  label: string;
  selectable: boolean;
  totalCount: number;
};

export type DataTableExplorerCategorySummary =
  DataTableExplorerSummaryStatus & {
    bucketCount: number;
    buckets: DataTableExplorerCategoryBucket[];
    client?: MosaicClient;
    kind: 'category';
    selectedKey?: string;
    toggleValue: (key: string) => void;
  };

export type DataTableExplorerUnsupportedSummary =
  DataTableExplorerSummaryStatus & {
    kind: 'unsupported';
    label: string;
  };

/**
 * Summary state for columns whose summary was disabled via
 * {@link DataTableExplorerOptions.getColumnKind}. No summary clients are
 * connected for these columns.
 */
export type DataTableExplorerNoneSummary = DataTableExplorerSummaryStatus & {
  kind: 'none';
};

export type DataTableExplorerSummaryState =
  | DataTableExplorerCategorySummary
  | DataTableExplorerHistogramSummary
  | DataTableExplorerNoneSummary
  | DataTableExplorerUnsupportedSummary;

export type DataTableExplorerColumnKind =
  | 'category'
  | 'histogram'
  | 'none'
  | 'unsupported';

/**
 * Per-column summary-kind override returned by
 * {@link DataTableExplorerOptions.getColumnKind}.
 *
 * - `'auto'` keeps the default Arrow-type-driven behavior.
 * - `'none'` shows the column without a summary or filter interactions.
 * - `'category'` / `'histogram'` force a specific summary; incompatible
 *   requests (e.g. a histogram on a string column) fall back to `'auto'`.
 */
export type DataTableExplorerColumnKindOverride =
  | 'auto'
  | 'category'
  | 'histogram'
  | 'none';

export type DataTableExplorerColumnState = {
  field: Field;
  kind: DataTableExplorerColumnKind;
  name: string;
  summary: DataTableExplorerSummaryState;
};

/**
 * Resolved SQLRooms table identity accepted by DataTableExplorer.
 */
export type DataTableExplorerTableReference = QualifiedTableName;

/**
 * DataTableExplorer-specific alias for Mosaic SQL AST table references.
 */
export type DataTableExplorerSqlTableReference = MosaicSqlTableReference;

export type DataTableExplorerOptions = {
  categoryLimit?: number;
  columns?: string[];
  /**
   * Resolves the summary kind for each column. Return `'auto'` (or omit the
   * option) to keep the default Arrow-type-driven behavior. Return `'none'`
   * to show a column without a summary — its summary clients are not created,
   * so no summary queries run and the column does not participate in
   * cross-filtering.
   *
   * Pass a stable function (e.g. via `useCallback`); the resolved kinds are
   * value-memoized, so an inline lambda works but must stay pure.
   */
  getColumnKind?: (field: Field) => DataTableExplorerColumnKindOverride;
  initialSorting?: DataTableExplorerSorting;
  pageSize?: number;
  selection?: Selection;
  selectionName?: string;
  summaryBins?: number;
  tableName: DataTableExplorerTableReference;
};

export type UseDataTableExplorerReturn = {
  client: MosaicClient | null;
  columns: DataTableExplorerColumnState[];
  filteredRowCount?: number;
  hasFilters: boolean;
  isLoading: boolean;
  pageQuery: string;
  pageTable?: Table;
  pagination: DataTableExplorerPaginationState;
  reset: () => void;
  selection: Selection;
  setPagination: Dispatch<SetStateAction<DataTableExplorerPaginationState>>;
  setSorting: Dispatch<SetStateAction<DataTableExplorerSorting>>;
  sorting: DataTableExplorerSorting;
  sql: string;
  tableError?: Error;
  totalRowCount?: number;
};
