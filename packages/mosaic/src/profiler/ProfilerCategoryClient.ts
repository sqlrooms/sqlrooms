import {MosaicClient, clausePoint, type Selection} from '@uwdata/mosaic-core';
import {type ExprNode, Query} from '@uwdata/mosaic-sql';
import type * as arrow from 'apache-arrow';
import type {MosaicProfilerCategorySummary} from './types';
import {
  buildCategoryBuckets,
  buildCategorySummaryQuery,
  categoryKeyToSelectionValue,
  type CategoryCountRow,
  isSelectableCategoryKey,
  rowsFromQueryResult,
} from './utils';

type CategoryClientOptions = {
  categoryLimit: number;
  field: arrow.Field;
  onStateChange: (summary: MosaicProfilerCategorySummary) => void;
  selection: Selection;
  tableName: string;
};

export class ProfilerCategoryClient extends MosaicClient {
  private readonly categoryLimit: number;
  private filteredError?: Error;
  private filteredLoading = true;
  private readonly field: arrow.Field;
  private readonly onStateChange: (
    summary: MosaicProfilerCategorySummary,
  ) => void;
  private selectedKey?: string;
  private filteredRows?: CategoryCountRow[];
  private readonly tableName: string;
  private totalError?: Error;
  private totalLoading = true;
  private totalRows?: CategoryCountRow[];

  constructor(options: CategoryClientOptions) {
    super(options.selection);
    this.categoryLimit = options.categoryLimit;
    this.field = options.field;
    this.onStateChange = options.onStateChange;
    this.tableName = options.tableName;
  }

  override get filterStable(): boolean {
    return false;
  }

  private emitSummary() {
    const filteredRows = this.filteredRows ?? this.totalRows ?? [];
    const totalRows = this.totalRows ?? filteredRows;
    const {bucketCount, buckets} = buildCategoryBuckets(
      filteredRows,
      totalRows,
      this.categoryLimit,
      this.selectedKey,
    );

    this.onStateChange({
      bucketCount,
      buckets,
      error: this.filteredError ?? this.totalError,
      isLoading: this.filteredLoading || this.totalLoading,
      kind: 'category',
      selectedKey: this.selectedKey,
      toggleValue: (key) => this.toggleValue(key),
    });
  }

  setTotalError(error?: Error) {
    this.totalError = error;
    this.totalLoading = false;
    this.emitSummary();
  }

  setTotalLoading(isLoading: boolean) {
    this.totalLoading = isLoading;
    this.emitSummary();
  }

  setTotalRows(rows: CategoryCountRow[]) {
    this.totalRows = rows
      .slice()
      .sort(
        (left: CategoryCountRow, right: CategoryCountRow) =>
          right.total - left.total,
      );
    this.totalError = undefined;
    this.totalLoading = false;
    this.emitSummary();
  }

  override queryPending(): this {
    this.filteredLoading = true;
    this.emitSummary();
    return this;
  }

  override query(filter: Array<ExprNode> = []): Query {
    return buildCategorySummaryQuery(this.tableName, this.field.name, filter);
  }

  override queryResult(data: unknown): this {
    const rows = rowsFromQueryResult<CategoryCountRow>(data)
      .slice()
      .sort(
        (left: CategoryCountRow, right: CategoryCountRow) =>
          right.total - left.total,
      );
    this.filteredRows = rows;
    this.filteredError = undefined;
    this.filteredLoading = false;
    this.emitSummary();
    return this;
  }

  override queryError(error: Error): this {
    this.filteredError = error;
    this.filteredLoading = false;
    this.emitSummary();
    return this;
  }

  reset() {
    this.selectedKey = undefined;
    this.emitSummary();
  }

  toggleValue(key: string) {
    if (!isSelectableCategoryKey(key)) {
      return;
    }

    this.selectedKey = this.selectedKey === key ? undefined : key;
    this.filterBy?.update(
      clausePoint(
        this.field.name,
        categoryKeyToSelectionValue(this.selectedKey),
        {
          source: this,
        },
      ),
    );
    this.emitSummary();
  }
}

type ProfilerCategoryTotalClientOptions = {
  summaryClient: ProfilerCategoryClient;
};

export class ProfilerCategoryTotalClient extends MosaicClient {
  private readonly summaryClient: ProfilerCategoryClient;

  constructor(options: ProfilerCategoryTotalClientOptions) {
    super();
    this.summaryClient = options.summaryClient;
  }

  override queryPending(): this {
    this.summaryClient.setTotalLoading(true);
    return this;
  }

  override query(filter: Array<ExprNode> = []): Query {
    return this.summaryClient.query(filter);
  }

  override queryResult(data: unknown): this {
    this.summaryClient.setTotalRows(rowsFromQueryResult<CategoryCountRow>(data));
    return this;
  }

  override queryError(error: Error): this {
    this.summaryClient.setTotalError(error);
    return this;
  }
}
