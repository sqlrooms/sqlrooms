import {Badge, cn, TableHead, TableHeader, TableRow} from '@sqlrooms/ui';
import {ChevronDownIcon, ChevronUpIcon} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {
  getProfilerColumnWidthPx,
  PROFILER_DEFAULT_COLUMN_WIDTH_PX,
  PROFILER_ROW_NUMBER_COLUMN_WIDTH_PX,
  PROFILER_UNSUPPORTED_COLUMN_WIDTH_PX,
} from './profiler/layout';
import type {
  MosaicProfilerCategorySummary,
  MosaicProfilerColumnState,
  MosaicProfilerHistogramSummary,
  MosaicProfilerSorting,
  UseMosaicProfilerReturn,
} from './profiler/types';
import {isProfilerUnsupportedSummaryType} from './profiler/utils';

export type MosaicProfilerHeaderProps = {
  className?: string;
  profiler: Pick<UseMosaicProfilerReturn, 'columns' | 'setSorting' | 'sorting'>;
};

const COLUMN_WIDTH_CLASS = `min-w-[${PROFILER_DEFAULT_COLUMN_WIDTH_PX}px] w-[${PROFILER_DEFAULT_COLUMN_WIDTH_PX}px] max-w-[${PROFILER_DEFAULT_COLUMN_WIDTH_PX}px]`;
const STICKY_ROW_NUMBER_CLASS = `bg-background sticky left-0 top-0 z-40 min-w-[${PROFILER_ROW_NUMBER_COLUMN_WIDTH_PX}px] w-[${PROFILER_ROW_NUMBER_COLUMN_WIDTH_PX}px] max-w-[${PROFILER_ROW_NUMBER_COLUMN_WIDTH_PX}px] border-r px-1 text-center`;
const STICKY_COLUMN_HEADER_CLASS =
  'bg-background sticky top-0 z-30 align-top whitespace-nowrap shadow-[inset_0_-1px_0_hsl(var(--border))]';

function getColumnWidthClass(column: MosaicProfilerColumnState) {
  return isProfilerUnsupportedSummaryType(column.field.type)
    ? `min-w-[${PROFILER_UNSUPPORTED_COLUMN_WIDTH_PX}px] w-[${PROFILER_UNSUPPORTED_COLUMN_WIDTH_PX}px] max-w-[${PROFILER_UNSUPPORTED_COLUMN_WIDTH_PX}px]`
    : COLUMN_WIDTH_CLASS;
}

function setNextSortState(
  currentSorting: MosaicProfilerSorting,
  columnId: string,
  setSorting: UseMosaicProfilerReturn['setSorting'],
) {
  const current = currentSorting.find((entry) => entry.id === columnId);
  if (!current) {
    setSorting([{desc: false, id: columnId}]);
    return;
  }
  if (!current.desc) {
    setSorting([{desc: true, id: columnId}]);
    return;
  }
  setSorting([]);
}

function formatPercentOfTotal(value: number) {
  const maximumFractionDigits = value >= 0.1 ? 0 : value >= 0.01 ? 1 : 2;
  return Intl.NumberFormat(undefined, {
    maximumFractionDigits,
    style: 'percent',
  }).format(value);
}

function CategorySummaryCell({
  summary,
}: {
  summary: MosaicProfilerCategorySummary;
}) {
  const [hoveredKey, setHoveredKey] = useState<string>();
  const totalCount = summary.buckets.reduce(
    (acc, bucket) => acc + bucket.totalCount,
    0,
  );
  const activeBucket = summary.buckets.find(
    (bucket) => bucket.key === hoveredKey || bucket.key === summary.selectedKey,
  );
  const footerLabel = activeBucket
    ? `${activeBucket.label} (${activeBucket.totalCount.toLocaleString()} ${activeBucket.totalCount === 1 ? 'row' : 'rows'}, ${formatPercentOfTotal(totalCount > 0 ? activeBucket.totalCount / totalCount : 0)})`
    : `${summary.bucketCount.toLocaleString()} categories`;

  return (
    <div className="space-y-0.5 pt-1.5">
      <div className="flex h-10 overflow-hidden rounded-sm border">
        {summary.buckets.map((bucket) => {
          const width =
            totalCount > 0
              ? `${(bucket.totalCount / totalCount) * 100}%`
              : '0%';
          const fillPct =
            bucket.totalCount > 0
              ? (bucket.filteredCount / bucket.totalCount) * 100
              : 0;
          const isSelected = summary.selectedKey === bucket.key;
          const background =
            bucket.kind === 'overflow'
              ? `repeating-linear-gradient(to right, hsl(var(--border)) 0px, hsl(var(--border)) 2px, transparent 2px, transparent 4px)`
              : `linear-gradient(to top, hsl(var(--chart-1)) ${fillPct}%, hsl(var(--muted-foreground) / 0.22) ${fillPct}%, hsl(var(--muted-foreground) / 0.22) 100%)`;

          return (
            <button
              key={bucket.key}
              type="button"
              disabled={!bucket.selectable}
              className={cn(
                'relative flex h-full items-center justify-center overflow-hidden border-r px-0.5 text-[10px] font-normal text-white transition-opacity disabled:cursor-default',
                isSelected && 'ring-ring ring-1 ring-inset',
                !bucket.selectable && 'text-muted-foreground',
              )}
              style={{
                background,
                flexBasis: width,
                flexGrow: bucket.totalCount,
              }}
              onClick={() => summary.toggleValue(bucket.key)}
              onMouseEnter={() => setHoveredKey(bucket.key)}
              onMouseLeave={() => setHoveredKey(undefined)}
            >
              <span className="max-w-full truncate px-1">{bucket.label}</span>
            </button>
          );
        })}
      </div>
      <div className="text-muted-foreground truncate text-[10px] font-normal">
        {footerLabel}
      </div>
    </div>
  );
}

type ScaleLike = {
  apply: (value: number | Date) => number;
  domain: [number | Date, number | Date];
  invert: (value: number) => number | Date;
  range: [number, number];
  type: 'linear' | 'utc';
};

const histogramInteractorIds = new WeakMap<object, number>();
let nextHistogramInteractorId = 0;

function getHistogramInteractorId(interactor: object) {
  const cachedId = histogramInteractorIds.get(interactor);
  if (cachedId !== undefined) {
    return cachedId;
  }

  const id = ++nextHistogramInteractorId;
  histogramInteractorIds.set(interactor, id);
  return id;
}

function createScale(
  type: ScaleLike['type'],
  domain: [number | Date, number | Date],
  range: [number, number],
): ScaleLike {
  const [d0, d1] = domain.map((value) =>
    value instanceof Date ? value.getTime() : value,
  ) as [number, number];
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const rspan = r1 - r0;

  return {
    apply(value: number | Date) {
      const numeric = value instanceof Date ? value.getTime() : value;
      return r0 + ((numeric - d0) / span) * rspan;
    },
    domain,
    invert(value: number) {
      const numeric = d0 + ((value - r0) / (rspan || 1)) * span;
      return type === 'utc' ? new Date(numeric) : numeric;
    },
    range,
    type,
  };
}

function formatDomainValue(value: number | Date, valueType: 'date' | 'number') {
  if (valueType === 'date') {
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString().slice(0, 10);
  }
  return Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(typeof value === 'number' ? value : value.getTime());
}

function HistogramSummaryCell({
  summary,
}: {
  summary: MosaicProfilerHistogramSummary;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const brushRootRef = useRef<SVGGElement>(null);
  const initializedBrushRef = useRef<string | undefined>(undefined);

  const layout = useMemo(() => {
    const width = 122;
    const height = 40;
    const margin = {bottom: 4, left: 4, right: 4, top: 2};
    const nullBarWidth = summary.totalNullCount > 0 ? 5 : 0;
    const nullBarGap = nullBarWidth > 0 ? 3 : 0;
    const totalBins = summary.totalBins.length
      ? summary.totalBins
      : summary.filteredBins;
    const domain: [number | Date, number | Date] | null =
      totalBins.length > 0
        ? [totalBins[0]!.x0, totalBins[totalBins.length - 1]!.x1]
        : null;
    const totalMax = Math.max(
      summary.totalNullCount,
      ...totalBins.map((bin) => bin.length),
      1,
    );
    const xScale = domain
      ? createScale(summary.valueType === 'date' ? 'utc' : 'linear', domain, [
          margin.left + nullBarWidth + nullBarGap,
          width - margin.right,
        ])
      : null;
    const yScale = createScale(
      'linear',
      [0, totalMax],
      [height - margin.bottom, margin.top],
    );
    return {
      height,
      margin,
      nullBarGap,
      nullBarWidth,
      width,
      xScale,
      yScale,
    };
  }, [summary]);

  useEffect(() => {
    const svg = svgRef.current;
    const brushRoot = brushRootRef.current;
    const interactor = summary.interactor;
    if (!svg || !brushRoot || !interactor || !layout.xScale) return;

    const brushKey = [
      getHistogramInteractorId(interactor),
      summary.valueType,
      layout.xScale.domain
        .map((value) => (value instanceof Date ? value.getTime() : value))
        .join(':'),
      layout.xScale.range.join(':'),
    ].join('|');
    if (initializedBrushRef.current === brushKey) return;

    (
      svg as SVGSVGElement & {
        scale: (channel: string) => ScaleLike | undefined;
      }
    ).scale = (channel: string) => {
      if (channel === 'x') return layout.xScale!;
      if (channel === 'y') return layout.yScale;
      return undefined;
    };

    brushRoot.replaceChildren();
    interactor.init(svg as any, brushRoot);
    initializedBrushRef.current = brushKey;
  }, [layout.xScale, layout.yScale, summary.interactor, summary.valueType]);

  const axisY = layout.height - layout.margin.bottom;
  const nullBarCenter = layout.margin.left + layout.nullBarWidth / 2;
  const xAxisStart = layout.xScale?.range[0] ?? layout.margin.left;
  const xAxisEnd =
    layout.xScale?.range[1] ?? layout.width - layout.margin.right;

  return (
    <div className="space-y-0 pt-1.5">
      <svg
        ref={svgRef}
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="max-w-full overflow-visible"
      >
        {summary.totalNullCount > 0 ? (
          <rect
            x={layout.margin.left}
            y={layout.yScale.apply(summary.totalNullCount)}
            width={layout.nullBarWidth}
            height={
              layout.yScale.apply(0) -
              layout.yScale.apply(summary.totalNullCount)
            }
            fill="hsl(var(--muted-foreground) / 0.22)"
          />
        ) : null}
        {summary.totalNullCount > 0 ? (
          <rect
            x={layout.margin.left}
            y={layout.yScale.apply(summary.filteredNullCount)}
            width={layout.nullBarWidth}
            height={
              layout.yScale.apply(0) -
              layout.yScale.apply(summary.filteredNullCount)
            }
            fill="hsl(var(--chart-1))"
            opacity={0.95}
          />
        ) : null}
        {summary.totalBins.map((bin, index) => {
          const x0 = layout.xScale?.apply(bin.x0) ?? 0;
          const x1 = layout.xScale?.apply(bin.x1) ?? 0;
          const y = layout.yScale.apply(bin.length);
          return (
            <rect
              key={`bg-${index}`}
              x={x0 + 1}
              y={y}
              width={Math.max(x1 - x0 - 1, 1)}
              height={layout.yScale.apply(0) - y}
              fill="hsl(var(--muted-foreground) / 0.22)"
            />
          );
        })}
        {summary.filteredBins.map((bin, index) => {
          const x0 = layout.xScale?.apply(bin.x0) ?? 0;
          const x1 = layout.xScale?.apply(bin.x1) ?? 0;
          const y = layout.yScale.apply(bin.length);
          return (
            <rect
              key={`fg-${index}`}
              x={x0 + 1}
              y={y}
              width={Math.max(x1 - x0 - 1, 1)}
              height={layout.yScale.apply(0) - y}
              fill="hsl(var(--chart-1))"
              opacity={0.95}
            />
          );
        })}
        <line
          x1={xAxisStart}
          x2={xAxisEnd}
          y1={axisY}
          y2={axisY}
          stroke="hsl(var(--border))"
        />
        <line
          x1={xAxisStart}
          x2={xAxisStart}
          y1={axisY}
          y2={axisY + 2.5}
          stroke="hsl(var(--border))"
        />
        <line
          x1={xAxisEnd}
          x2={xAxisEnd}
          y1={axisY}
          y2={axisY + 2.5}
          stroke="hsl(var(--border))"
        />
        {summary.totalNullCount > 0 ? (
          <line
            x1={nullBarCenter}
            x2={nullBarCenter}
            y1={axisY}
            y2={axisY + 2.5}
            stroke="hsl(var(--chart-1))"
          />
        ) : null}
        <g ref={brushRootRef} />
      </svg>
      <div className="text-muted-foreground relative h-3.5 text-[10px] font-normal">
        {summary.totalNullCount > 0 ? (
          <span
            className="absolute -translate-x-1/2"
            style={{left: nullBarCenter}}
          >
            ∅
          </span>
        ) : null}
        <span className="absolute" style={{left: xAxisStart}}>
          {summary.totalBins[0]
            ? formatDomainValue(summary.totalBins[0].x0, summary.valueType)
            : '0'}
        </span>
        <span className="absolute -translate-x-full" style={{left: xAxisEnd}}>
          {summary.totalBins.at(-1)
            ? formatDomainValue(summary.totalBins.at(-1)!.x1, summary.valueType)
            : '0'}
        </span>
      </div>
    </div>
  );
}

function SummaryCell({column}: {column: MosaicProfilerColumnState}) {
  if (column.summary.kind === 'histogram') {
    return <HistogramSummaryCell summary={column.summary} />;
  }
  if (column.summary.kind === 'category') {
    return <CategorySummaryCell summary={column.summary} />;
  }
  return (
    <div className="text-muted-foreground pt-1.5 text-[10px] font-normal">
      {column.summary.label}
    </div>
  );
}

export function MosaicProfilerHeader({
  className,
  profiler,
}: MosaicProfilerHeaderProps) {
  return (
    <>
      <colgroup>
        <col style={{width: PROFILER_ROW_NUMBER_COLUMN_WIDTH_PX}} />
        {profiler.columns.map((column) => (
          <col
            key={column.name}
            style={{width: getProfilerColumnWidthPx(column)}}
          />
        ))}
      </colgroup>
      <TableHeader className={cn('sticky top-0 z-30', className)}>
        <TableRow>
          <TableHead className={STICKY_ROW_NUMBER_CLASS}>#</TableHead>
          {profiler.columns.map((column) => {
            const sortState = profiler.sorting.find(
              (entry) => entry.id === column.name,
            );
            return (
              <TableHead
                key={column.name}
                className={cn(
                  getColumnWidthClass(column),
                  STICKY_COLUMN_HEADER_CLASS,
                )}
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    className="group relative flex w-full items-start gap-1.5 pr-4 text-left"
                    onClick={() =>
                      setNextSortState(
                        profiler.sorting,
                        column.name,
                        profiler.setSorting,
                      )
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] leading-tight font-semibold">
                        {column.name}
                      </div>
                      <Badge
                        variant="outline"
                        className="mt-0.5 max-w-full truncate px-2 py-0 text-[9px] opacity-60"
                      >
                        {String(column.field.type)}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground pointer-events-none absolute top-1 right-0 flex h-4 w-4 items-center justify-center">
                      {sortState ? (
                        sortState.desc ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronUpIcon className="h-4 w-4" />
                        )
                      ) : (
                        <span className="flex h-4 w-4 flex-col items-center justify-center opacity-0 transition-opacity group-hover:opacity-60">
                          <ChevronUpIcon className="-mb-1 h-3 w-3" />
                          <ChevronDownIcon className="-mt-1 h-3 w-3" />
                        </span>
                      )}
                    </span>
                  </button>
                  <SummaryCell column={column} />
                </div>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
    </>
  );
}
