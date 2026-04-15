import {MosaicClient, type Selection} from '@uwdata/mosaic-core';
import {type ExprNode, type Query} from '@uwdata/mosaic-sql';
import type * as arrow from 'apache-arrow';
import type {MosaicProfilerUnsupportedSummary} from './types';
import {buildDistinctCountQuery, readCountData} from './utils';

type UnsupportedSummaryClientOptions = {
  field: arrow.Field;
  onStateChange: (summary: MosaicProfilerUnsupportedSummary) => void;
  selection: Selection;
  tableName: string;
};

export class ProfilerUnsupportedSummaryClient extends MosaicClient {
  private count = 0;
  private readonly field: arrow.Field;
  private readonly onStateChange: (
    summary: MosaicProfilerUnsupportedSummary,
  ) => void;
  private readonly tableName: string;

  constructor(options: UnsupportedSummaryClientOptions) {
    super(options.selection);
    this.field = options.field;
    this.onStateChange = options.onStateChange;
    this.tableName = options.tableName;
  }

  override get filterStable(): boolean {
    return false;
  }

  override queryPending(): this {
    this.onStateChange({
      isLoading: true,
      kind: 'unsupported',
      label: `${this.count.toLocaleString()} distinct values`,
    });
    return this;
  }

  override query(filter: Array<ExprNode> = []): Query {
    return buildDistinctCountQuery({
      fieldName: this.field.name,
      filter,
      tableName: this.tableName,
    });
  }

  override queryResult(data: unknown): this {
    this.count = readCountData(data) ?? 0;
    this.onStateChange({
      isLoading: false,
      kind: 'unsupported',
      label: `${this.count.toLocaleString()} distinct values`,
    });
    return this;
  }

  override queryError(error: Error): this {
    this.onStateChange({
      error,
      isLoading: false,
      kind: 'unsupported',
      label: `${this.count.toLocaleString()} distinct values`,
    });
    return this;
  }
}
