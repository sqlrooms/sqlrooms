import {VgPlotChart} from '@sqlrooms/mosaic';
import {cn} from '@sqlrooms/ui';
import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {useRoomStore} from '../../store';
import {
  buildEarthquakeProfilerPlots,
  createEarthquakeProfilerTableEl,
  DEFAULT_EARTHQUAKE_PROFILER_COLUMNS,
  EARTHQUAKE_PROFILER_COLUMN_WIDTH,
  type EarthquakeProfilerColumnDef,
} from './earthquakeProfilerMosaic.shared';

type EarthquakeProfilerMosaicContextValue = {
  columns: EarthquakeProfilerColumnDef[];
  plots: ReturnType<typeof buildEarthquakeProfilerPlots>;
  tableEl: HTMLElement;
};

const earthquakeProfilerMosaicContext =
  createContext<EarthquakeProfilerMosaicContextValue | null>(null);

function useEarthquakeProfilerMosaicContext() {
  const context = useContext(earthquakeProfilerMosaicContext);

  if (!context) {
    throw new Error(
      'EarthquakeProfilerMosaic compound components must be rendered inside <EarthquakeProfilerMosaic> or <EarthquakeProfilerMosaic.Root>.',
    );
  }

  return context;
}

type EarthquakeProfilerMosaicRootProps = PropsWithChildren<{
  columns?: EarthquakeProfilerColumnDef[];
  selectionName?: string;
  tableName?: string;
}>;

function EarthquakeProfilerMosaicRoot({
  children,
  columns = DEFAULT_EARTHQUAKE_PROFILER_COLUMNS,
  selectionName = 'brush',
  tableName = 'earthquakes',
}: EarthquakeProfilerMosaicRootProps) {
  const mosaic = useRoomStore((state) => state.mosaic);
  const brush = useMemo(
    () => mosaic.getSelection(selectionName),
    [mosaic, selectionName],
  );

  const tableEl = useMemo(
    () =>
      createEarthquakeProfilerTableEl({
        brush,
        columns,
        tableName,
      }),
    [brush, columns, tableName],
  );
  const plots = useMemo(
    () =>
      buildEarthquakeProfilerPlots({
        brush,
        columns,
        tableName,
      }),
    [brush, columns, tableName],
  );

  const value = useMemo(
    () => ({
      columns,
      plots,
      tableEl,
    }),
    [columns, plots, tableEl],
  );

  return (
    <earthquakeProfilerMosaicContext.Provider value={value}>
      {children}
    </earthquakeProfilerMosaicContext.Provider>
  );
}

function EarthquakeProfilerMosaicTitle({className}: {className?: string}) {
  useEarthquakeProfilerMosaicContext();

  return (
    <div className={cn('shrink-0 px-3 py-2', className)}>
      <h2 className="text-sm font-semibold">Earthquake Profiler</h2>
      <p className="text-muted-foreground text-xs">
        Cross-filtered rows and per-column summaries powered by Mosaic.
      </p>
    </div>
  );
}

function EarthquakeProfilerMosaicSummaryStrip({
  className,
}: {
  className?: string;
}) {
  const {columns, plots} = useEarthquakeProfilerMosaicContext();

  return (
    <div className={cn('shrink-0 border-b', className)}>
      <div className="flex">
        {columns.map(({column, label}, index) => (
          <div
            key={column}
            className="shrink-0 px-1 pt-1"
            style={{width: EARTHQUAKE_PROFILER_COLUMN_WIDTH}}
          >
            <p className="text-foreground mb-0.5 truncate text-[11px] font-semibold">
              {label}
            </p>
            <VgPlotChart plot={plots[index]!} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EarthquakeProfilerMosaicTable({className}: {className?: string}) {
  const {tableEl} = useEarthquakeProfilerMosaicContext();

  return (
    <div className={cn('min-h-0 flex-1 [&>div]:h-full', className)}>
      <VgPlotChart plot={tableEl} />
    </div>
  );
}

function EarthquakeProfilerMosaicViewport({className}: {className?: string}) {
  const {columns} = useEarthquakeProfilerMosaicContext();

  return (
    <div
      className={cn(
        'min-h-0 flex-1 overflow-x-auto overflow-y-hidden',
        className,
      )}
    >
      <div
        className="flex h-full flex-col"
        style={{width: columns.length * EARTHQUAKE_PROFILER_COLUMN_WIDTH}}
      >
        <EarthquakeProfilerMosaicSummaryStrip />
        <EarthquakeProfilerMosaicTable />
      </div>
    </div>
  );
}

type EarthquakeProfilerMosaicProps = {
  className?: string;
  columns?: EarthquakeProfilerColumnDef[];
  selectionName?: string;
  tableName?: string;
};

function EarthquakeProfilerMosaicComponent({
  className,
  columns,
  selectionName,
  tableName,
}: EarthquakeProfilerMosaicProps) {
  return (
    <EarthquakeProfilerMosaicRoot
      columns={columns}
      selectionName={selectionName}
      tableName={tableName}
    >
      <section
        className={cn(
          'bg-background flex min-h-0 flex-col border-t',
          className,
        )}
      >
        <EarthquakeProfilerMosaicTitle />
        <EarthquakeProfilerMosaicViewport />
      </section>
    </EarthquakeProfilerMosaicRoot>
  );
}

type EarthquakeProfilerMosaicCompoundComponent = ((
  props: EarthquakeProfilerMosaicProps,
) => ReactNode) & {
  Root: typeof EarthquakeProfilerMosaicRoot;
  SummaryStrip: typeof EarthquakeProfilerMosaicSummaryStrip;
  Table: typeof EarthquakeProfilerMosaicTable;
  Title: typeof EarthquakeProfilerMosaicTitle;
  Viewport: typeof EarthquakeProfilerMosaicViewport;
};

export const EarthquakeProfilerMosaic: EarthquakeProfilerMosaicCompoundComponent =
  Object.assign(EarthquakeProfilerMosaicComponent, {
    Root: EarthquakeProfilerMosaicRoot,
    SummaryStrip: EarthquakeProfilerMosaicSummaryStrip,
    Table: EarthquakeProfilerMosaicTable,
    Title: EarthquakeProfilerMosaicTitle,
    Viewport: EarthquakeProfilerMosaicViewport,
  });
