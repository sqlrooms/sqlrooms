import {MosaicClient, type Selection} from '@uwdata/mosaic-core';
import {type ExprNode, type Query} from '@uwdata/mosaic-sql';
import type {Table} from 'apache-arrow';
import type {
  MosaicProfilerPaginationState,
  MosaicProfilerSorting,
} from './types';
import {buildProfilerBaseQuery, buildProfilerPageQuery} from './utils';

export type ProfilerPageState = {
  error?: Error;
  isLoading: boolean;
  pageTable?: Table;
};

type ProfilerPageClientOptions = {
  columns: string[];
  filter?: ReturnType<Selection['predicate']>;
  onStateChange: (state: ProfilerPageState) => void;
  pagination: MosaicProfilerPaginationState;
  sorting: MosaicProfilerSorting;
  tableName: string;
};

export class ProfilerPageClient extends MosaicClient {
  private readonly columns: string[];
  private error?: Error;
  private readonly filter?: ReturnType<Selection['predicate']>;
  private readonly onStateChange: (state: ProfilerPageState) => void;
  private readonly pagination: MosaicProfilerPaginationState;
  private pageTable?: Table;
  private readonly sorting: MosaicProfilerSorting;
  private readonly tableName: string;

  constructor(options: ProfilerPageClientOptions) {
    super();
    this.columns = options.columns;
    this.filter = options.filter ?? [];
    this.onStateChange = options.onStateChange;
    this.pagination = options.pagination;
    this.sorting = options.sorting;
    this.tableName = options.tableName;
  }

  override get filterStable(): boolean {
    return false;
  }

  override queryPending(): this {
    this.onStateChange({
      error: this.error,
      isLoading: true,
      pageTable: this.pageTable,
    });
    return this;
  }

  override query(filter: Array<ExprNode> = []): Query {
    const resolvedFilter = this.filter ?? filter;
    return buildProfilerPageQuery(
      buildProfilerBaseQuery({
        columns: this.columns,
        filter: resolvedFilter,
        sorting: this.sorting,
        tableName: this.tableName,
      }),
      this.pagination,
    );
  }

  override queryResult(data: unknown): this {
    this.error = undefined;
    this.pageTable = data as Table;
    this.onStateChange({
      isLoading: false,
      pageTable: this.pageTable,
    });
    return this;
  }

  override queryError(error: Error): this {
    this.error = error;
    this.onStateChange({
      error,
      isLoading: false,
      pageTable: this.pageTable,
    });
    return this;
  }
}
