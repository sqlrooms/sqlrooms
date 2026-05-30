import {MosaicClient, type Selection} from '@uwdata/mosaic-core';
import {type ExprNode, type Query} from '@uwdata/mosaic-sql';
import {buildCountQuery, readCountData} from './utils';

export type ProfilerCountState = {
  count?: number;
  error?: Error;
  isLoading: boolean;
};

type ProfilerCountClientOptions = {
  filterStable?: boolean;
  onStateChange: (state: ProfilerCountState) => void;
  selection?: Selection;
  tableName: string;
};

export class ProfilerCountClient extends MosaicClient {
  private count?: number;
  private error?: Error;
  private readonly isFilterStable: boolean;
  private readonly onStateChange: (state: ProfilerCountState) => void;
  private readonly tableName: string;

  constructor(options: ProfilerCountClientOptions) {
    super(options.selection);
    this.isFilterStable = options.filterStable ?? false;
    this.onStateChange = options.onStateChange;
    this.tableName = options.tableName;
  }

  override get filterStable(): boolean {
    return this.isFilterStable;
  }

  override queryPending(): this {
    this.onStateChange({
      count: this.count,
      error: this.error,
      isLoading: true,
    });
    return this;
  }

  override query(filter: Array<ExprNode> = []): Query {
    return buildCountQuery({
      filter,
      tableName: this.tableName,
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
