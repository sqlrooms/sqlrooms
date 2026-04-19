import {vg} from '@sqlrooms/mosaic';
import type {Selection} from '@uwdata/mosaic-core';

export type EarthquakeProfilerColumnDef = {
  column: string;
  kind: 'cat' | 'hist';
  label: string;
};

export const EARTHQUAKE_PROFILER_BG = '#c8c8c8';
export const EARTHQUAKE_PROFILER_FG = '#e67f5f';
export const EARTHQUAKE_PROFILER_COLUMN_WIDTH = 130;
export const EARTHQUAKE_PROFILER_CHART_HEIGHT = 80;
export const EARTHQUAKE_PROFILER_CHART_MARGINS = {
  left: 2,
  right: 4,
  top: 4,
  bottom: 4,
};

export const DEFAULT_EARTHQUAKE_PROFILER_COLUMNS: EarthquakeProfilerColumnDef[] =
  [
    {column: 'DateTime', label: 'DateTime', kind: 'hist'},
    {column: 'Latitude', label: 'Latitude', kind: 'hist'},
    {column: 'Longitude', label: 'Longitude', kind: 'hist'},
    {column: 'Depth', label: 'Depth', kind: 'hist'},
    {column: 'Magnitude', label: 'Magnitude', kind: 'hist'},
    {column: 'MagType', label: 'MagType', kind: 'cat'},
    {column: 'NbStations', label: 'NbStations', kind: 'hist'},
    {column: 'Gap', label: 'Gap', kind: 'hist'},
    {column: 'Distance', label: 'Distance', kind: 'hist'},
    {column: 'RMS', label: 'RMS', kind: 'hist'},
    {column: 'Source', label: 'Source', kind: 'cat'},
    {column: 'EventID', label: 'EventID', kind: 'hist'},
  ];

export function buildEarthquakeProfilerPlots(options: {
  brush: Selection;
  columns: EarthquakeProfilerColumnDef[];
  tableName: string;
}) {
  const {brush, columns, tableName} = options;

  return columns.map(({column, kind}) =>
    kind === 'cat'
      ? vg.plot(
          vg.rectY(vg.from(tableName), {
            x: column,
            y: vg.count(),
            fill: EARTHQUAKE_PROFILER_BG,
            inset: 0.5,
          }),
          vg.rectY(vg.from(tableName, {filterBy: brush}), {
            x: column,
            y: vg.count(),
            fill: EARTHQUAKE_PROFILER_FG,
            inset: 0.5,
          }),
          vg.toggleX({as: brush}),
          vg.yAxis(null),
          vg.xAxis('bottom'),
          vg.width(EARTHQUAKE_PROFILER_COLUMN_WIDTH - 8),
          vg.height(EARTHQUAKE_PROFILER_CHART_HEIGHT),
          vg.marginLeft(EARTHQUAKE_PROFILER_CHART_MARGINS.left),
          vg.marginRight(EARTHQUAKE_PROFILER_CHART_MARGINS.right),
          vg.marginTop(EARTHQUAKE_PROFILER_CHART_MARGINS.top),
          vg.marginBottom(EARTHQUAKE_PROFILER_CHART_MARGINS.bottom),
        )
      : vg.plot(
          vg.rectY(vg.from(tableName), {
            x: vg.bin(column),
            y: vg.count(),
            fill: EARTHQUAKE_PROFILER_BG,
            inset: 0.5,
          }),
          vg.rectY(vg.from(tableName, {filterBy: brush}), {
            x: vg.bin(column),
            y: vg.count(),
            fill: EARTHQUAKE_PROFILER_FG,
            inset: 0.5,
          }),
          vg.intervalX({as: brush}),
          vg.yAxis(null),
          vg.xAxis(null),
          vg.width(EARTHQUAKE_PROFILER_COLUMN_WIDTH - 8),
          vg.height(EARTHQUAKE_PROFILER_CHART_HEIGHT),
          vg.marginLeft(EARTHQUAKE_PROFILER_CHART_MARGINS.left),
          vg.marginRight(EARTHQUAKE_PROFILER_CHART_MARGINS.right),
          vg.marginTop(EARTHQUAKE_PROFILER_CHART_MARGINS.top),
          vg.marginBottom(EARTHQUAKE_PROFILER_CHART_MARGINS.bottom),
        ),
  );
}

/**
 * Creates the Mosaic/VG table element and injects table-scoped CSS directly
 * onto that generated node.
 *
 * This styling can not come from Tailwind classes alone because `vg.table()`
 * renders its own DOM subtree outside our JSX, with runtime-generated element
 * ids and internal table markup that React never sees. Injecting CSS against
 * `#${el.id}` keeps the sticky header, typography, cell truncation, and local
 * scroll behavior attached to this specific Mosaic table instance without
 * leaking styles to other tables in the app.
 */
export function createEarthquakeProfilerTableEl(options: {
  brush: Selection;
  columns: EarthquakeProfilerColumnDef[];
  tableName: string;
}) {
  const {brush, columns, tableName} = options;
  const width = Object.fromEntries(
    columns.map(({column}) => [column, EARTHQUAKE_PROFILER_COLUMN_WIDTH]),
  );

  const el = vg.table({
    from: tableName,
    filterBy: brush,
    rowBatch: 50,
    columns: columns.map((column) => column.column),
    width,
  });

  const style = document.createElement('style');
  style.textContent = `
    #${el.id} {
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 12px;
      scrollbar-width: thin;
      height: 100% !important;
      overflow-y: auto !important;
    }
    #${el.id} table {
      border-collapse: collapse;
    }
    #${el.id} thead tr {
      position: sticky;
      top: 0;
      z-index: 1;
      background: hsl(var(--background));
      border-bottom: 1px solid hsl(var(--border));
    }
    #${el.id} th {
      padding: 6px 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: hsl(var(--muted-foreground));
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      overflow: hidden;
      box-sizing: border-box;
    }
    #${el.id} th:hover { color: hsl(var(--foreground)); }
    #${el.id} td {
      padding: 5px 12px;
      border-bottom: 1px solid hsl(var(--border) / 0.5);
      color: hsl(var(--foreground));
      white-space: nowrap;
      overflow: hidden;
      box-sizing: border-box;
    }
    #${el.id} tbody tr:hover td { background: hsl(var(--muted) / 0.5); }
  `;
  el.appendChild(style);

  return el;
}
