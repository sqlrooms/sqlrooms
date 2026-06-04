import {DataTable} from '@sqlrooms/db';
import type {Selection} from '@uwdata/mosaic-core';
import type {Interval1D} from '@uwdata/mosaic-plot';
import type {Field, Table} from 'apache-arrow';
import type {Dispatch, SetStateAction} from 'react';

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
    kind: 'category';
    selectedKey?: string;
    toggleValue: (key: string) => void;
  };

export type DataTableExplorerUnsupportedSummary =
  DataTableExplorerSummaryStatus & {
    kind: 'unsupported';
    label: string;
  };

export type DataTableExplorerSummaryState =
  | DataTableExplorerCategorySummary
  | DataTableExplorerHistogramSummary
  | DataTableExplorerUnsupportedSummary;

export type DataTableExplorerColumnKind =
  | 'category'
  | 'histogram'
  | 'unsupported';

export type DataTableExplorerColumnState = {
  field: Field;
  kind: DataTableExplorerColumnKind;
  name: string;
  summary: DataTableExplorerSummaryState;
};

export type DataTableExplorerOptions = {
  categoryLimit?: number;
  columns?: string[];
  initialSorting?: DataTableExplorerSorting;
  pageSize?: number;
  selection?: Selection;
  selectionName?: string;
  summaryBins?: number;
  tableName: DataTable;
};

export type UseDataTableExplorerReturn = {
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
