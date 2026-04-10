import type {FieldInfo} from '@uwdata/mosaic-core';
import {
  MosaicClient,
  queryFieldInfo,
  type Selection,
} from '@uwdata/mosaic-core';
import {count, type ExprNode, Query} from '@uwdata/mosaic-sql';
import {Interval1D, bin} from '@uwdata/mosaic-plot';
import type * as arrow from 'apache-arrow';
import {splitHistogramBins} from './utils';
import type {MosaicProfilerHistogramSummary} from './types';

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
  private readonly field: arrow.Field;
  private readonly onStateChange: HistogramStateChange;
  private readonly select: {
    x1: ExprNode;
    x2: ExprNode;
    y: ExprNode;
  };
  private readonly tableName: string;
  private readonly valueType: 'date' | 'number';
  private fieldInfo?: FieldInfo;
  private readonly interactor: Interval1D;
  private filteredBins?: HistogramRow[];
  private filteredNullCount?: number;
  private totalBins?: HistogramRow[];
  private totalNullCount?: number;

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

  override queryPending(): this {
    const totalRows = this.totalBins ?? [];
    const total = splitHistogramBins(totalRows);
    const filteredRows = this.filteredBins ?? totalRows;
    const filtered = splitHistogramBins(filteredRows);
    this.onStateChange({
      filteredBins: filtered.bins,
      filteredNullCount: this.filteredNullCount ?? filtered.nullCount,
      interactor: this.interactor,
      isLoading: true,
      kind: 'histogram',
      totalBins: total.bins,
      totalNullCount: this.totalNullCount ?? total.nullCount,
      valueType: this.valueType,
    });
    return this;
  }

  override async prepare(): Promise<void> {
    const [info] = await queryFieldInfo(this.coordinator!, [
      {
        table: this.tableName,
        column: this.field.name,
        stats: ['min', 'max'],
      },
    ]);
    this.fieldInfo = info;
    const totalData = await this.coordinator!.query(this.query([]));
    const totalRows = Array.from(
      ((totalData as unknown) as {toArray(): HistogramRow[]}).toArray(),
    );
    const {nullCount} = splitHistogramBins(totalRows);
    this.totalBins = totalRows;
    this.totalNullCount = nullCount;
  }

  override query(filter: Array<ExprNode> = []): Query {
    return Query.from({source: this.tableName})
      .select(this.select)
      .groupby([this.select.x1, this.select.x2])
      .where(filter);
  }

  override queryResult(data: unknown): this {
    const rows = Array.from((data as {toArray(): HistogramRow[]}).toArray());
    const {bins, nullCount} = splitHistogramBins(rows);
    this.filteredBins = rows;
    this.filteredNullCount = nullCount;

    const totalRows = this.totalBins ?? rows;
    const total = splitHistogramBins(totalRows);
    this.onStateChange({
      filteredBins: bins,
      filteredNullCount: nullCount,
      interactor: this.interactor,
      isLoading: false,
      kind: 'histogram',
      totalBins: total.bins,
      totalNullCount: this.totalNullCount ?? total.nullCount,
      valueType: this.valueType,
    });
    return this;
  }

  override queryError(error: Error): this {
    const total = splitHistogramBins(this.totalBins ?? []);
    const filtered = splitHistogramBins(this.filteredBins ?? this.totalBins ?? []);
    this.onStateChange({
      error,
      filteredBins: filtered.bins,
      filteredNullCount: this.filteredNullCount ?? filtered.nullCount,
      interactor: this.interactor,
      isLoading: false,
      kind: 'histogram',
      totalBins: total.bins,
      totalNullCount: this.totalNullCount ?? total.nullCount,
      valueType: this.valueType,
    });
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
