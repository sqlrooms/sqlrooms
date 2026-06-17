import {MosaicClient, type Selection} from '@uwdata/mosaic-core';
import {type ExprNode, type Query} from '@uwdata/mosaic-sql';
import type {Table} from 'apache-arrow';
import type {
  DataTableExplorerPaginationState,
  DataTableExplorerSorting,
} from './types';
import {
  buildDataTableExplorerBaseQuery,
  buildDataTableExplorerPageQuery,
} from './utils';

export type DataTableExplorerPageState = {
  datasetId?: string;
  error?: Error;
  isLoading: boolean;
  pageTable?: Table;
};

type DataTableExplorerPageClientOptions = {
  columns: string[];
  filter?: ReturnType<Selection['predicate']>;
  onStateChange: (state: DataTableExplorerPageState) => void;
  pagination: DataTableExplorerPaginationState;
  sorting: DataTableExplorerSorting;
  tableName: string;
};

export class DataTableExplorerPageClient extends MosaicClient {
  private readonly columns: string[];
  private readonly datasetId: string;
  private error?: Error;
  private readonly filter?: ReturnType<Selection['predicate']>;
  private readonly onStateChange: (state: DataTableExplorerPageState) => void;
  private readonly pagination: DataTableExplorerPaginationState;
  private pageTable?: Table;
  private readonly sorting: DataTableExplorerSorting;
  private readonly tableName: string;

  constructor(options: DataTableExplorerPageClientOptions) {
    super();
    this.columns = options.columns;
    this.datasetId = [options.tableName, ...options.columns].join('\u0001');
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
      datasetId: this.datasetId,
      error: this.error,
      isLoading: true,
      pageTable: this.pageTable,
    });
    return this;
  }

  override query(filter: Array<ExprNode> = []): Query {
    const resolvedFilter = this.filter ?? filter;
    return buildDataTableExplorerPageQuery(
      buildDataTableExplorerBaseQuery({
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
      datasetId: this.datasetId,
      isLoading: false,
      pageTable: this.pageTable,
    });
    return this;
  }

  override queryError(error: Error): this {
    this.error = error;
    this.onStateChange({
      datasetId: this.datasetId,
      error,
      isLoading: false,
      pageTable: this.pageTable,
    });
    return this;
  }
}
