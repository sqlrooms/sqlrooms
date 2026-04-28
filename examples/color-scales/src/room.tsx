import {
  buildColorScaleLegend,
  ColorScaleLegend,
  createColorScaleMapper,
  type ColorScaleConfig,
  type ResolvedColorLegend,
} from '@sqlrooms/color-scales';
import {useSql} from '@sqlrooms/duckdb';
import {
  createRoomShellSlice,
  createRoomStore,
  RoomShell,
  type RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {Spinner, ThemeProvider, ThemeSwitch, cn} from '@sqlrooms/ui';
import {useMemo} from 'react';

type CarRow = {
  Car: string;
  MPG: number;
  Cylinders: number;
  Displacement: number;
  Horsepower: number;
  Weight: number;
  Acceleration: number;
  Model: number;
  Origin: string;
};

type LegendExample = {
  label: string;
  description: string;
  colorScale: ColorScaleConfig;
};

type LegendWithExample = LegendExample & {
  legend: ResolvedColorLegend;
};

const legendExamples: LegendExample[] = [
  {
    label: 'Fuel Economy',
    description: 'Sequential ramp over MPG',
    colorScale: {
      field: 'MPG',
      type: 'sequential',
      scheme: 'Viridis',
      domain: 'auto',
      legend: {title: 'MPG'},
    },
  },
  {
    label: 'Horsepower',
    description: 'Quantile bins',
    colorScale: {
      field: 'Horsepower',
      type: 'quantile',
      scheme: 'YlOrRd',
      bins: 5,
      legend: {title: 'Horsepower'},
    },
  },
  {
    label: 'Vehicle Weight',
    description: 'Equal-width bins',
    colorScale: {
      field: 'Weight',
      type: 'quantize',
      scheme: 'PuBuGn',
      domain: 'auto',
      bins: 6,
      legend: {title: 'Weight'},
    },
  },
  {
    label: 'Acceleration',
    description: 'Diverging around the fleet midpoint',
    colorScale: {
      field: 'Acceleration',
      type: 'diverging',
      scheme: 'RdBu',
      domain: 'auto',
      reverse: true,
      legend: {title: 'Acceleration'},
    },
  },
  {
    label: 'Cylinders',
    description: 'Explicit thresholds',
    colorScale: {
      field: 'Cylinders',
      type: 'threshold',
      scheme: 'Spectral',
      thresholds: [4, 6, 8],
      legend: {title: 'Cylinders'},
    },
  },
  {
    label: 'Origin',
    description: 'Categorical swatches',
    colorScale: {
      field: 'Origin',
      type: 'categorical',
      scheme: 'Tableau10',
      legend: {title: 'Origin'},
    },
  },
];

export type RoomState = RoomShellSliceState;

const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      config: {
        dataSources: [
          {
            type: 'url',
            url: 'https://huggingface.co/datasets/sqlrooms/cars/resolve/main/cars.parquet',
            tableName: 'cars',
          },
        ],
      },
    })(set, get, store),
  }),
);

export const Room = () => (
  <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
    <RoomShell className="bg-background h-screen" roomStore={roomStore}>
      <div className="absolute top-4 right-4 z-10">
        <ThemeSwitch />
      </div>
      <ColorScalesApp />
    </RoomShell>
  </ThemeProvider>
);

function getColumnValues(rows: CarRow[], field: string) {
  return rows.map((row) => row[field as keyof CarRow]);
}

function buildLegends(rows: CarRow[]): LegendWithExample[] {
  return legendExamples.flatMap((example) => {
    const legend = buildColorScaleLegend({
      colorScale: example.colorScale,
      values: getColumnValues(rows, example.colorScale.field),
    });

    return legend ? [{...example, legend}] : [];
  });
}

function SampleCars({
  rows,
  colorScale,
}: {
  rows: CarRow[];
  colorScale: ColorScaleConfig;
}) {
  const mapper = useMemo(
    () =>
      createColorScaleMapper({
        colorScale,
        values: getColumnValues(rows, colorScale.field),
      }),
    [colorScale, rows],
  );
  const sampleRows = rows.slice(0, 10);

  return (
    <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5">
      {sampleRows.map((row) => {
        const value = row[colorScale.field as keyof CarRow];
        const color = mapper(value);
        return (
          <div
            key={`${colorScale.field}-${row.Car}`}
            className="flex min-w-0 items-center gap-2 text-xs"
            title={`${row.Car}: ${String(value)}`}
          >
            <span
              className="border-border h-2.5 w-2.5 shrink-0 rounded-[2px] border"
              style={{
                backgroundColor: `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${
                  color[3] / 255
                })`,
              }}
            />
            <span className="text-muted-foreground truncate">{row.Car}</span>
          </div>
        );
      })}
    </div>
  );
}

function LegendCard({
  example,
  rows,
}: {
  example: LegendWithExample;
  rows: CarRow[];
}) {
  return (
    <section className="border-border bg-card rounded-lg border p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-card-foreground text-sm font-semibold">
          {example.label}
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          {example.description}
        </p>
      </div>
      <ColorScaleLegend
        legends={[example.legend]}
        width={300}
        swatchColumns={2}
      />
      <SampleCars rows={rows} colorScale={example.colorScale} />
    </section>
  );
}

function ColorScalesApp() {
  const isTableReady = useRoomStore((state) =>
    Boolean(state.db.findTableByName('cars')),
  );
  const queryResult = useSql<CarRow>({
    query: `SELECT * FROM cars ORDER BY Model, Car`,
    enabled: isTableReady,
  });
  const rows = useMemo(
    () => queryResult.data?.toArray() ?? [],
    [queryResult.data],
  );
  const legends = useMemo(() => buildLegends(rows), [rows]);

  if (!isTableReady || queryResult.isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <main className="h-full overflow-auto">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="max-w-3xl">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            SQLRooms color scales
          </p>
          <h1 className="text-foreground mt-2 text-3xl font-semibold tracking-normal">
            Cars legend gallery
          </h1>
          <p className="text-muted-foreground mt-3 text-sm leading-6">
            {rows.length.toLocaleString()} rows from the cars parquet dataset,
            rendered through shared color-scale configs.
          </p>
        </header>
        <div
          className={cn(
            'grid gap-4',
            'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3',
          )}
        >
          {legends.map((example) => (
            <LegendCard
              key={`${example.colorScale.field}-${example.colorScale.type}`}
              example={example}
              rows={rows}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
