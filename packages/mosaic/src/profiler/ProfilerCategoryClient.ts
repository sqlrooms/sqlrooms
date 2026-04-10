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
  private readonly field: arrow.Field;
  private readonly onStateChange: (
    summary: MosaicProfilerCategorySummary,
  ) => void;
  private selectedKey?: string;
  private filteredRows?: CategoryCountRow[];
  private readonly tableName: string;
  private totalRows?: CategoryCountRow[];

  constructor(options: CategoryClientOptions) {
    super(options.selection);
    this.categoryLimit = options.categoryLimit;
    this.field = options.field;
    this.onStateChange = options.onStateChange;
    this.tableName = options.tableName;
  }

  override async prepare(): Promise<void> {
    const totalData = await this.coordinator!.query(this.query([]));
    this.totalRows = Array.from(
      ((totalData as unknown) as {toArray(): CategoryCountRow[]}).toArray(),
    )
      .slice()
      .sort(
        (left: CategoryCountRow, right: CategoryCountRow) =>
          right.total - left.total,
      );
  }

  override queryPending(): this {
    const {bucketCount, buckets} = buildCategoryBuckets(
      this.filteredRows ?? this.totalRows ?? [],
      this.totalRows ?? [],
      this.categoryLimit,
      this.selectedKey,
    );
    this.onStateChange({
      bucketCount,
      buckets,
      isLoading: true,
      kind: 'category',
      selectedKey: this.selectedKey,
      toggleValue: (key) => this.toggleValue(key),
    });
    return this;
  }

  override query(filter: Array<ExprNode> = []): Query {
    return buildCategorySummaryQuery(this.tableName, this.field.name, filter);
  }

  override queryResult(data: unknown): this {
    const rows = Array.from((data as {toArray(): CategoryCountRow[]}).toArray())
      .slice()
      .sort(
        (left: CategoryCountRow, right: CategoryCountRow) =>
          right.total - left.total,
      );
    this.filteredRows = rows;
    const totalRows = this.totalRows ?? rows;

    const {bucketCount, buckets} = buildCategoryBuckets(
      rows,
      totalRows,
      this.categoryLimit,
      this.selectedKey,
    );

    this.onStateChange({
      bucketCount,
      buckets,
      isLoading: false,
      kind: 'category',
      selectedKey: this.selectedKey,
      toggleValue: (key) => this.toggleValue(key),
    });
    return this;
  }

  override queryError(error: Error): this {
    const {bucketCount, buckets} = buildCategoryBuckets(
      this.filteredRows ?? this.totalRows ?? [],
      this.totalRows ?? [],
      this.categoryLimit,
      this.selectedKey,
    );
    this.onStateChange({
      bucketCount,
      buckets,
      error,
      isLoading: false,
      kind: 'category',
      selectedKey: this.selectedKey,
      toggleValue: (key) => this.toggleValue(key),
    });
    return this;
  }

  reset() {
    this.selectedKey = undefined;
    const {bucketCount, buckets} = buildCategoryBuckets(
      this.filteredRows ?? this.totalRows ?? [],
      this.totalRows ?? [],
      this.categoryLimit,
      this.selectedKey,
    );
    this.onStateChange({
      bucketCount,
      buckets,
      isLoading: false,
      kind: 'category',
      selectedKey: this.selectedKey,
      toggleValue: (key) => this.toggleValue(key),
    });
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

    const {bucketCount, buckets} = buildCategoryBuckets(
      this.filteredRows ?? this.totalRows ?? [],
      this.totalRows ?? [],
      this.categoryLimit,
      this.selectedKey,
    );
    this.onStateChange({
      bucketCount,
      buckets,
      isLoading: false,
      kind: 'category',
      selectedKey: this.selectedKey,
      toggleValue: (key) => this.toggleValue(key),
    });
  }
}
