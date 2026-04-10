import {Badge, cn, TableHead, TableHeader, TableRow} from '@sqlrooms/ui';
import {ChevronDownIcon, ChevronUpIcon} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
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

const COLUMN_WIDTH_CLASS = 'min-w-[170px]';
const STICKY_ROW_NUMBER_CLASS =
  'bg-background sticky left-0 top-0 z-40 min-w-[48px] border-r text-center';
const STICKY_COLUMN_HEADER_CLASS =
  'bg-background sticky top-0 z-30 align-top whitespace-nowrap shadow-[inset_0_-1px_0_hsl(var(--border))]';

function getColumnWidthClass(column: MosaicProfilerColumnState) {
  return isProfilerUnsupportedSummaryType(column.field.type)
    ? 'min-w-[120px] w-[120px] max-w-[120px]'
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
    ? `${activeBucket.label} (${activeBucket.filteredCount.toLocaleString()} / ${activeBucket.totalCount.toLocaleString()})`
    : `${summary.bucketCount.toLocaleString()} categories`;

  return (
    <div className="space-y-1 pt-2">
      <div className="flex h-12 overflow-hidden rounded-sm border">
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
                'relative flex h-full items-center justify-center overflow-hidden border-r px-1 text-[11px] font-normal text-white transition-opacity disabled:cursor-default',
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
      <div className="text-muted-foreground truncate text-[11px] font-normal">
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

function toNumber(value: number | Date) {
  return value instanceof Date ? value.getTime() : value;
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
    const width = 150;
    const height = 52;
    const margin = {bottom: 14, left: 4, right: 4, top: 2};
    const totalBins = summary.totalBins.length
      ? summary.totalBins
      : summary.filteredBins;
    const domain: [number | Date, number | Date] | null =
      totalBins.length > 0
        ? [
            totalBins[0]!.x0,
            totalBins[totalBins.length - 1]!.x1,
          ]
        : null;
    const totalMax = Math.max(
      summary.totalNullCount,
      ...totalBins.map((bin) => bin.length),
      1,
    );
    const xScale = domain
      ? createScale(
          summary.valueType === 'date' ? 'utc' : 'linear',
          domain,
          [margin.left, width - margin.right],
        )
      : null;
    const yScale = createScale(
      'linear',
      [0, totalMax],
      [height - margin.bottom, margin.top],
    );
    return {height, margin, width, xScale, yScale};
  }, [summary]);

  useEffect(() => {
    const svg = svgRef.current;
    const brushRoot = brushRootRef.current;
    const interactor = summary.interactor;
    if (!svg || !brushRoot || !interactor || !layout.xScale) return;

    const brushKey = [
      summary.valueType,
      layout.xScale.domain
        .map((value) =>
          value instanceof Date ? value.getTime() : value,
        )
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

  return (
    <div className="space-y-1 pt-2">
      <svg
        ref={svgRef}
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="max-w-full overflow-visible"
      >
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
          x1={layout.margin.left}
          x2={layout.width - layout.margin.right}
          y1={layout.height - layout.margin.bottom}
          y2={layout.height - layout.margin.bottom}
          stroke="hsl(var(--border))"
        />
        <g ref={brushRootRef} />
      </svg>
      <div className="text-muted-foreground flex justify-between text-[11px] font-normal">
        <span>
          {summary.totalBins[0]
            ? formatDomainValue(summary.totalBins[0].x0, summary.valueType)
            : '0'}
        </span>
        <span>
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
    <div className="text-muted-foreground pt-2 text-[11px] font-normal">
      {column.summary.label}
    </div>
  );
}

export function MosaicProfilerHeader({
  className,
  profiler,
}: MosaicProfilerHeaderProps) {
  return (
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
                  className="flex w-full items-start gap-2 text-left"
                  onClick={() =>
                    setNextSortState(
                      profiler.sorting,
                      column.name,
                      profiler.setSorting,
                    )
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {column.name}
                    </div>
                    <Badge
                      variant="outline"
                      className="mt-1 max-w-full truncate text-[10px] opacity-60"
                    >
                      {String(column.field.type)}
                    </Badge>
                  </div>
                  {sortState ? (
                    sortState.desc ? (
                      <ChevronDownIcon className="mt-1 h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronUpIcon className="mt-1 h-4 w-4 shrink-0" />
                    )
                  ) : null}
                </button>
                <SummaryCell column={column} />
              </div>
            </TableHead>
          );
        })}
      </TableRow>
    </TableHeader>
  );
}
