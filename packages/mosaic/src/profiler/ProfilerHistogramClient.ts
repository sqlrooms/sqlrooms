import type {FieldInfo} from '@uwdata/mosaic-core';
import {
  MosaicClient,
  queryFieldInfo,
  type Selection,
} from '@uwdata/mosaic-core';
import {Interval1D, bin} from '@uwdata/mosaic-plot';
import {count, type ExprNode, Query} from '@uwdata/mosaic-sql';
import type * as arrow from 'apache-arrow';
import type {MosaicProfilerHistogramSummary} from './types';
import {rowsFromQueryResult, splitHistogramBins} from './utils';

type HistogramStateChange = (summary: MosaicProfilerHistogramSummary) => void;

type HistogramClientOptions = {
  field: arrow.Field;
  onStateChange: HistogramStateChange;
  selection: Selection;
  steps: number;
  tableName: string;
  valueType: 'date' | 'number';
};

type HistogramRow = {
  x1: number | Date | null;
  x2: number | Date | null;
  y: number;
};

export class ProfilerHistogramClient extends MosaicClient {
  readonly type = 'rectY';
  private filteredError?: Error;
  private filteredLoading = true;
  private readonly field: arrow.Field;
  private fieldInfo?: FieldInfo;
  private fieldInfoPromise?: Promise<void>;
  private filteredBins?: HistogramRow[];
  private filteredNullCount?: number;
  private readonly interactor: Interval1D;
  private readonly onStateChange: HistogramStateChange;
  private readonly select: {
    x1: ExprNode;
    x2: ExprNode;
    y: ExprNode;
  };
  private readonly tableName: string;
  private totalBins?: HistogramRow[];
  private totalError?: Error;
  private totalLoading = true;
  private totalNullCount?: number;
  private readonly valueType: 'date' | 'number';

  constructor(options: HistogramClientOptions) {
    super(options.selection);
    this.field = options.field;
    this.onStateChange = options.onStateChange;
    this.tableName = options.tableName;
    this.valueType = options.valueType;

    const binned = bin(options.field.name, {steps: options.steps})(
      this,
      'x',
    ) as unknown as {
      x1: ExprNode;
      x2: ExprNode;
    };
    this.select = {x1: binned.x1, x2: binned.x2, y: count()};
    this.interactor = new Interval1D(this, {
      brush: undefined,
      channel: 'x',
      field: options.field.name,
      peers: false,
      selection: options.selection,
    });
  }

  override get filterStable(): boolean {
    return true;
  }

  private emitSummary() {
    const totalRows = this.totalBins ?? this.filteredBins ?? [];
    const total = splitHistogramBins(totalRows);
    const filteredRows = this.filteredBins ?? totalRows;
    const filtered = splitHistogramBins(filteredRows);

    this.onStateChange({
      error: this.filteredError ?? this.totalError,
      filteredBins: filtered.bins,
      filteredNullCount: this.filteredNullCount ?? filtered.nullCount,
      interactor: this.interactor,
      isLoading: this.filteredLoading || this.totalLoading,
      kind: 'histogram',
      totalBins: total.bins,
      totalNullCount: this.totalNullCount ?? total.nullCount,
      valueType: this.valueType,
    });
  }

  async ensureFieldInfo(): Promise<void> {
    if (this.fieldInfo) {
      return;
    }

    if (!this.fieldInfoPromise) {
      this.fieldInfoPromise = queryFieldInfo(this.coordinator!, [
        {
          table: this.tableName,
          column: this.field.name,
          stats: ['min', 'max'],
        },
      ]).then(([info]) => {
        this.fieldInfo = info;
      });
    }

    await this.fieldInfoPromise;
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

  setTotalRows(rows: HistogramRow[]) {
    const {nullCount} = splitHistogramBins(rows);
    this.totalBins = rows;
    this.totalNullCount = nullCount;
    this.totalError = undefined;
    this.totalLoading = false;
    this.emitSummary();
  }

  override queryPending(): this {
    this.filteredLoading = true;
    this.emitSummary();
    return this;
  }

  override async prepare(): Promise<void> {
    await this.ensureFieldInfo();
  }

  override query(filter: Array<ExprNode> = []): Query {
    return Query.from({source: this.tableName})
      .select(this.select)
      .groupby([this.select.x1, this.select.x2])
      .where(filter);
  }

  override queryResult(data: unknown): this {
    const rows = rowsFromQueryResult<HistogramRow>(data);
    const {nullCount} = splitHistogramBins(rows);
    this.filteredBins = rows;
    this.filteredNullCount = nullCount;
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

  channelField(channel: string) {
    if (channel !== 'x') {
      throw new Error('ProfilerHistogramClient only supports x bins');
    }
    if (!this.fieldInfo) {
      throw new Error('Field info is required before histogram binning');
    }
    return this.fieldInfo;
  }

  get plot(): {
    getAttribute(name: string): undefined;
    markSet: Set<ProfilerHistogramClient>;
  } {
    const markSet = new Set([this]);
    return {
      getAttribute(_name: string) {
        return undefined;
      },
      markSet,
    };
  }
}

type ProfilerHistogramTotalClientOptions = {
  summaryClient: ProfilerHistogramClient;
};

export class ProfilerHistogramTotalClient extends MosaicClient {
  private readonly summaryClient: ProfilerHistogramClient;

  constructor(options: ProfilerHistogramTotalClientOptions) {
    super();
    this.summaryClient = options.summaryClient;
  }

  override async prepare(): Promise<void> {
    await this.summaryClient.ensureFieldInfo();
  }

  override queryPending(): this {
    this.summaryClient.setTotalLoading(true);
    return this;
  }

  override query(filter: Array<ExprNode> = []): Query {
    return this.summaryClient.query(filter);
  }

  override queryResult(data: unknown): this {
    this.summaryClient.setTotalRows(rowsFromQueryResult<HistogramRow>(data));
    return this;
  }

  override queryError(error: Error): this {
    this.summaryClient.setTotalError(error);
    return this;
  }
}
