import {MosaicClient} from '@uwdata/mosaic-core';
import {column, Query, sql} from '@uwdata/mosaic-sql';
import type {QualifiedTableName} from '@sqlrooms/duckdb';
import {getMosaicSqlTableReference} from '../../../../mosaicTableReference';
import {readCountData} from '../../../../data-table-explorer/utils';

export type CountPlotCategoryCountState = {
  count?: number;
  error?: Error;
  isLoading: boolean;
};

type CountPlotCategoryCountClientOptions = {
  field: string;
  onStateChange: (state: CountPlotCategoryCountState) => void;
  table: QualifiedTableName;
};

/**
 * Mosaic client that counts possible count-plot categories for sizing.
 */
export class CountPlotCategoryCountClient extends MosaicClient {
  private count?: number;
  private error?: Error;
  private readonly field: string;
  private readonly onStateChange: (state: CountPlotCategoryCountState) => void;
  private readonly table: QualifiedTableName;

  constructor(options: CountPlotCategoryCountClientOptions) {
    super();
    this.field = options.field;
    this.onStateChange = options.onStateChange;
    this.table = options.table;
  }

  override get filterStable(): boolean {
    return true;
  }

  override queryPending(): this {
    this.onStateChange({
      count: this.count,
      error: this.error,
      isLoading: true,
    });
    return this;
  }

  override query(): Query {
    const fieldColumn = column(this.field);

    return Query.from(getMosaicSqlTableReference(this.table)).select({
      count: sql`COUNT(DISTINCT ${fieldColumn}) + COALESCE(MAX(CASE WHEN ${fieldColumn} IS NULL THEN 1 ELSE 0 END), 0)`,
    });
  }

  override queryResult(data: unknown): this {
    this.count = readCountData(data);
    this.error = undefined;
    this.onStateChange({
      count: this.count,
      isLoading: false,
    });
    return this;
  }

  override queryError(error: Error): this {
    this.error = error;
    this.onStateChange({
      count: this.count,
      error,
      isLoading: false,
    });
    return this;
  }
}
