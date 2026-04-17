/**
 * Mag-vs-depth histogram for the currently visible slab.
 *
 * When a preset is active, the histogram is restricted to events inside the
 * slice window — so you see the classic Wadati–Benioff bimodal distribution
 * (shallow interface + deep slab cluster) emerge in real time as the
 * time-slider scrubs. When no preset is active, it shows the global
 * distribution for reference.
 */

import {FC, useMemo} from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
  XAxis,
  YAxis,
} from '@sqlrooms/recharts';
import {useSql} from '@sqlrooms/duckdb';
import {RoomPanel} from '@sqlrooms/room-shell';
import {useRoomStore} from './store';
import {EarthquakePanels} from './panel-keys';
import {
  buildHistogramSql,
  EARTHQUAKE_TABLE,
  MAG_BANDS,
  whereFragmentFor,
  type MagBandKey,
} from './earthquake-slice';

type HistogramRow = {depth_bin: number} & Record<MagBandKey, number>;

const CHART_CONFIG: ChartConfig = Object.fromEntries(
  MAG_BANDS.map((b) => [b.key, {label: b.label, color: b.color}]),
);

export const HistogramPanel: FC = () => {
  const presets = useRoomStore((s) => s.earthquakes.presets);
  const activePresetId = useRoomStore((s) => s.earthquakes.activePresetId);
  const sliceHalfWidthKm = useRoomStore((s) => s.earthquakes.sliceHalfWidthKm);

  const sqlQuery = useMemo(() => {
    const preset = presets.find((p) => p.id === activePresetId) ?? null;
    return buildHistogramSql(whereFragmentFor(preset, sliceHalfWidthKm));
  }, [presets, activePresetId, sliceHalfWidthKm]);

  // Gate on table existence so the query doesn't fire before the parquet
  // loads. Select a stable boolean so unrelated store updates don't retrigger
  // re-renders (matches the pattern in RenderingStatus and the CLAUDE.md
  // guidance on selector stability).
  const tableReady = useRoomStore((s) =>
    Boolean(s.db.findTableByName(EARTHQUAKE_TABLE)),
  );
  const {data, isLoading, error} = useSql<HistogramRow>({
    query: sqlQuery,
    enabled: tableReady,
  });

  // DuckDB's SUM over INT returns BIGINT/HUGEINT, which Arrow surfaces as
  // stringy values (BigInt-safe). We coerce to Number for chart plotting
  // and totaling — 17k events at counts well under 2^53 is safely in
  // Number precision.
  const rows = useMemo<HistogramRow[]>(() => {
    if (!data) return [];
    return data.toArray().map((r) => {
      const coerced: HistogramRow = {
        depth_bin: Number(r.depth_bin),
      } as HistogramRow;
      for (const b of MAG_BANDS) {
        coerced[b.key] = Number(r[b.key] ?? 0);
      }
      return coerced;
    });
  }, [data]);
  const total = useMemo(
    () =>
      rows.reduce(
        (acc, r) =>
          acc + MAG_BANDS.reduce((bandSum, b) => bandSum + r[b.key], 0),
        0,
      ),
    [rows],
  );

  return (
    <RoomPanel type={EarthquakePanels.Histogram}>
      <div className="flex h-full w-full flex-col gap-2 px-3 pb-3">
        <div className="text-xs leading-tight">
          <div className="font-medium">Magnitude by depth</div>
          <div className="text-muted-foreground">
            {activePresetId
              ? `Slab slice · ±${sliceHalfWidthKm} km of section line`
              : 'All events (global)'}
            {' · '}
            {total.toLocaleString()} events
          </div>
        </div>

        {error && (
          <div className="font-mono text-xs whitespace-pre-wrap text-red-500">
            {error.message}
          </div>
        )}

        {isLoading && !rows.length ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            Loading histogram…
          </div>
        ) : (
          <ChartContainer
            config={CHART_CONFIG}
            className="h-[180px] w-full flex-1"
          >
            <BarChart
              data={rows}
              margin={{top: 4, right: 8, bottom: 18, left: 8}}
            >
              <CartesianGrid
                strokeDasharray="2 4"
                className="stroke-muted-foreground/30"
              />
              <XAxis
                dataKey="depth_bin"
                tick={{fontSize: 10}}
                label={{
                  value: 'Depth (km)',
                  position: 'insideBottom',
                  offset: -6,
                  fontSize: 10,
                }}
              />
              <YAxis
                tick={{fontSize: 10}}
                label={{
                  value: 'Count',
                  angle: -90,
                  position: 'insideLeft',
                  fontSize: 10,
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(v) => `Depth ${v}–${Number(v) + 50} km`}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {MAG_BANDS.map((b) => (
                <Bar
                  key={b.key}
                  dataKey={b.key}
                  name={b.label}
                  stackId="mag"
                  fill={b.color}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </div>
    </RoomPanel>
  );
};
