import type {Selection} from '@uwdata/mosaic-core';
import type {Interval1D} from '@uwdata/mosaic-plot';
import type {Field, Table} from 'apache-arrow';
import type {Dispatch, SetStateAction} from 'react';

export type MosaicProfilerSorting = Array<{id: string; desc: boolean}>;

export type MosaicProfilerPaginationState = {
  pageIndex: number;
  pageSize: number;
};

export type MosaicProfilerBinValue = number | Date;

export type MosaicProfilerBin = {
  x0: MosaicProfilerBinValue;
  x1: MosaicProfilerBinValue;
  length: number;
};

export type MosaicProfilerSummaryStatus = {
  error?: Error;
  isLoading: boolean;
};

export type MosaicProfilerHistogramSummary = MosaicProfilerSummaryStatus & {
  filteredBins: MosaicProfilerBin[];
  filteredNullCount: number;
  interactor: Interval1D | null;
  kind: 'histogram';
  totalBins: MosaicProfilerBin[];
  totalNullCount: number;
  valueType: 'date' | 'number';
};

export type MosaicProfilerCategoryBucket = {
  filteredCount: number;
  key: string;
  kind: 'null' | 'overflow' | 'unique' | 'value';
  label: string;
  selectable: boolean;
  totalCount: number;
};

export type MosaicProfilerCategorySummary = MosaicProfilerSummaryStatus & {
  bucketCount: number;
  buckets: MosaicProfilerCategoryBucket[];
  kind: 'category';
  selectedKey?: string;
  toggleValue: (key: string) => void;
};

export type MosaicProfilerUnsupportedSummary = MosaicProfilerSummaryStatus & {
  kind: 'unsupported';
  label: string;
};

export type MosaicProfilerSummaryState =
  | MosaicProfilerCategorySummary
  | MosaicProfilerHistogramSummary
  | MosaicProfilerUnsupportedSummary;

export type MosaicProfilerColumnKind = 'category' | 'histogram' | 'unsupported';

export type MosaicProfilerColumnState = {
  field: Field;
  kind: MosaicProfilerColumnKind;
  name: string;
  summary: MosaicProfilerSummaryState;
};

export type MosaicProfilerOptions = {
  categoryLimit?: number;
  columns?: string[];
  initialSorting?: MosaicProfilerSorting;
  pageSize?: number;
  selection?: Selection;
  selectionName?: string;
  summaryBins?: number;
  tableName: string;
};

export type UseMosaicProfilerReturn = {
  columns: MosaicProfilerColumnState[];
  filteredRowCount?: number;
  hasFilters: boolean;
  isLoading: boolean;
  pageQuery: string;
  pageTable?: Table;
  pagination: MosaicProfilerPaginationState;
  reset: () => void;
  selection: Selection;
  setPagination: Dispatch<SetStateAction<MosaicProfilerPaginationState>>;
  setSorting: Dispatch<SetStateAction<MosaicProfilerSorting>>;
  sorting: MosaicProfilerSorting;
  sql: string;
  tableError?: Error;
  totalRowCount?: number;
};
