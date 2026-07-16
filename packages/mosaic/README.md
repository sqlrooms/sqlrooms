This package is part of the SQLRooms framework. It provides React components and hooks for integrating [Mosaic](https://idl.uw.edu/mosaic/) - a visualization library for data exploration and analysis - into SQLRooms applications.

## Overview

Mosaic is a JavaScript library for data visualization and analysis developed by the [Interactive Data Lab (IDL)](https://idl.uw.edu/) at the University of Washington. It combines the expressiveness of declarative visualization grammars with the power of reactive programming and SQL queries.

One of Mosaic's powerful features is its cross-filtering capability powered by DuckDB, allowing users to interactively filter and explore large datasets with millions of records directly in the browser. This enables creating interactive dashboards where selections in one chart automatically filter data in other charts. For an example of this functionality, see the [Cross-Filter Flights demo](https://idl.uw.edu/mosaic/examples/flights-200k.html) which demonstrates interactive filtering across multiple visualizations of a 200,000-record flight dataset.

This package provides:

- React components for rendering Vega-Lite charts using Mosaic
- Hooks for integrating Mosaic with DuckDB in SQLRooms applications
- Utilities for working with Mosaic specifications
- Reusable editor primitives for SQLRooms settings panels and code views

## Installation

```bash
npm install @sqlrooms/mosaic
```

## Usage

### Setting Up MosaicSlice

To use Mosaic in your SQLRooms application, you need to add the `MosaicSlice` to your room store. The slice manages the Mosaic connection and coordinates cross-filtering between multiple visualizations.

```tsx
import {createMosaicSlice, MosaicSliceState} from '@sqlrooms/mosaic';
import {createRoomStore, RoomShellSliceState} from '@sqlrooms/room-shell';
import {SqlEditorSliceState} from '@sqlrooms/sql-editor';

export type RoomState = RoomShellSliceState &
  SqlEditorSliceState &
  MosaicSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    // ... other slices
    ...createMosaicSlice()(set, get, store),
  }),
);
```

Mosaic's pre-aggregation optimization creates `preagg_*` cache tables lazily
when users interact with cross-filtered selections. By default Mosaic writes
those tables to the persistent `mosaic` schema. If the DuckDB database is a user
project file, point pre-aggregates at an attached cache database or disable them:

```tsx
const mosaicCacheDatabase = '__sqlrooms_mosaic_cache';

const connector = createWebSocketDuckDbConnector({
  initializationQuery: [
    `ATTACH IF NOT EXISTS ':memory:' AS ${mosaicCacheDatabase}`,
    `CREATE SCHEMA IF NOT EXISTS ${mosaicCacheDatabase}.mosaic`,
  ].join('; '),
});

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    // ... db slice using connector
    ...createMosaicSlice({
      preagg: {
        schema: `${mosaicCacheDatabase}.mosaic`,
      },
    })(set, get, store),
  }),
);
```

Set `preagg.enabled` to `false` when you prefer to avoid pre-aggregate tables
entirely.

The Mosaic connection is automatically initialized when the DuckDB connector is ready. You can check the connection status:

```tsx
import {useRoomStore} from './store';

function MyComponent() {
  const mosaicConn = useRoomStore((state) => state.mosaic.connection);

  if (mosaicConn.status === 'loading') {
    return <div>Loading Mosaic...</div>;
  }

  if (mosaicConn.status === 'error') {
    return <div>Error: {mosaicConn.error.message}</div>;
  }

  // Mosaic is ready when status === 'ready'
  return <div>Mosaic is ready!</div>;
}
```

### useMosaicClient Hook

The `useMosaicClient` hook creates a Mosaic client that automatically queries data based on filter selections. This is useful for building custom visualizations that respond to cross-filtering.

```tsx
import {Query, useMosaicClient} from '@sqlrooms/mosaic';

function MapView() {
  const {data, isLoading, client} = useMosaicClient({
    selectionName: 'brush', // Named selection for cross-filtering
    query: (filter: any) => {
      return Query.from('earthquakes')
        .select('Latitude', 'Longitude', 'Magnitude', 'Depth', 'DateTime')
        .where(filter); // filter is automatically applied based on selection
    },
  });

  if (isLoading) {
    return <div>Loading data...</div>;
  }

  // Use the data for your visualization
  return <div>Data loaded: {data?.numRows} rows</div>;
}
```

`useMosaicClient` returns an Apache Arrow table. Mosaic still uses its native
table runtime internally, but that detail is hidden at the hook boundary so
custom SQLRooms views can work with the same Arrow shape used by the DuckDB and
deck packages.

The hook accepts the following options:

- `id` - Optional unique identifier for this client (auto-generated if not provided)
- `selectionName` - Name of the selection to subscribe to for cross-filtering (will be created if it doesn't exist)
- `selection` - Alternatively, pass a `Selection` object directly
- `query` - Function that receives the current filter predicate and returns a Mosaic Query
- `queryResult` - Optional callback when query results are received
- `enabled` - Whether to automatically connect when mosaic is ready (default: `true`)

### Table Reference Boundaries

Persisted selected-table and block table identities use DuckDB's canonical
identity path: `getTableIdentity(table)` from `@sqlrooms/db`. Mosaic execution
helpers intentionally omit the catalog/database because Mosaic queries run
against the active connector.

| Use case                                                      | Helper/input                                             |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| Persist selected table or block table identity                | `getTableIdentity(table)`                                |
| Rehydrate or validate persisted identity                      | `parseTableIdentity(...)` or resolve against the catalog |
| Resolve dashboard/UI selected table string to a catalog table | `resolveMosaicTableReference(tables, value)`             |
| Build Mosaic query AST reference                              | `getMosaicSqlTableReference(...)`                        |
| Build raw SQL fragment for Mosaic-owned SQL                   | `getMosaicRawSqlTableReference(...)`                     |
| Serialize vgplot `data.from`                                  | `getMosaicVgPlotTableReference(...)`                     |
| Pass a table into `DataTableExplorer`                         | resolved `QualifiedTableName`, usually `dataTable.table` |

### Data Table Explorer Primitives

The Data Table Explorer primitives let you build a Quake-style cross-filtered
table with per-column summaries on top of `MosaicSlice`.

```tsx
import {DataTableExplorer} from '@sqlrooms/mosaic';
import {useDataTable} from '@sqlrooms/db';
import {ScrollArea} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {useRoomStore} from './store';

function EarthquakeExplorer() {
  const mosaic = useRoomStore((state) => state.mosaic);
  const brush = useMemo(() => mosaic.getSelection('brush'), [mosaic]);
  const dataTable = useDataTable('"main"."earthquakes"');

  if (!dataTable) {
    return null;
  }

  return (
    <DataTableExplorer
      tableName={dataTable.table}
      selection={brush}
      pageSize={25}
    >
      <div className="flex min-h-0 flex-col border">
        <ScrollArea className="min-h-0 flex-1">
          <DataTableExplorer.Table>
            <DataTableExplorer.Header />
            <DataTableExplorer.Rows />
          </DataTableExplorer.Table>
        </ScrollArea>
        <DataTableExplorer.StatusBar />
      </div>
    </DataTableExplorer>
  );
}
```

### Code View Primitives

Use `MosaicCodeViewerPanel` with `CodeViewToggleButton` for settings panels
that can switch between form controls and a read-only JSON/spec view with a
copy overlay.

```tsx
import {CodeViewToggleButton, MosaicCodeViewerPanel} from '@sqlrooms/mosaic';

function SettingsHeaderAction({
  showCode,
  onToggle,
}: {
  showCode: boolean;
  onToggle: () => void;
}) {
  return (
    <CodeViewToggleButton
      label={showCode ? 'Show settings' : 'View code'}
      selected={showCode}
      onClick={onToggle}
    />
  );
}

function CodeView({value}: {value: string}) {
  return <MosaicCodeViewerPanel value={value} copyTooltipLabel="Copy config" />;
}
```

### Count Plot Settings

`count-plot` chart configs support categorical counts by default and can also
aggregate a numeric `valueField` per category:

- `metric`: `"count"` or `"aggregate"`; defaults to `"count"`.
- `valueField`: numeric column required when `metric` is `"aggregate"`.
- `aggregate`: `"sum"`, `"avg"`, `"min"`, or `"max"`; defaults to `"sum"`.
- `sort`: `"value-desc"`, `"value-asc"`, `"label-asc"`, or `"label-desc"`;
  defaults to `"value-desc"`.
- `maxBars`: maximum number of displayed category bars; defaults to `10`.
- `leftMargin`: optional manual left margin in pixels. When omitted, SQLRooms
  derives a bounded left margin from chart metadata.

Choose the metric from the source-table grain. Use `"count"` for raw rows where
each row is an observation and category values repeat. Use `"aggregate"` for a
summarized table that already has a numeric measure, such as one row per
category with a `venue_count` column. The AI chart tool requires this choice
in its guidance, while tolerating omitted optional fields for model-provider
compatibility. When `metric` is omitted, a provided `valueField` implies
`"aggregate"`; otherwise the backwards-compatible default is `"count"`.

Count plots cap the visible categories instead of folding the hidden tail into
`Others` so the generated vgplot spec continues to cross-filter against the
source table without pre-aggregating the rendered values.
At runtime, count plots query the category cardinality and size the rendered
chart to the number of visible categories, capped by `maxBars`.
Bars use fixed row geometry; the chart grows or scrolls rather than stretching
or squeezing bar thickness.

For the common case, prefer the compound `DataTableExplorer` API.
`useDataTableExplorer` is still available when you need direct access to the
explorer state for custom layout, sizing, or advanced composition.

`DataTableBlockRenderer` wraps the same explorer UI as a stateful block
renderer for `@sqlrooms/documents` block documents. Register it with a
host-provided stateful block type such as `data-table` when a document or
other block document surface should embed an interactive Data Table Explorer
directly.

Use `DataTableSelector` or `DataTableSelectorEmptyState` when another host
surface needs the same searchable table picker used by dashboards and data
table blocks.

### Block Document AI Integrations

`createBlockDocumentChartTools`, `createAddMosaicDashboardBlockTool`, and
`createBlockDocumentDataTableExplorerTool` expose Mosaic-owned capabilities for
block-document hosts. The host provides a `BlockDocumentAiAdapter` from
`@sqlrooms/documents` plus callbacks for creating host-specific stateful block
state, then composes these tools with app-specific agent policy. The adapter may
append blocks through direct slice methods or by awaiting a command-backed
mutation supplied by the host.

### Mosaic Dashboard Panels

`MosaicDashboard` is a compound dashboard surface backed by generic dashboard
panels instead of a chart-only list. Configure supported panel renderers and
runtime add-panel actions when creating the dashboard slice.
Pass `readOnly` when embedding a dashboard in a read-only surface so reusable
settings panels disable or no-op mutating controls.

Default Mosaic panel renderers also expose reusable settings components through
their renderer definitions. `ChartSettingsPanel`, `ChartBlockSettings`,
`MosaicDashboardChartSettings`, `DataTableBlockSettings`,
`MosaicDashboardDataTableExplorerSettings`, and `MosaicDashboardSettings` can be
used by apps that provide the standard SQLRooms block-document, dashboard,
Mosaic, and DB slices.

```tsx
import {
  createDashboardFeatureSlices,
  createDefaultMosaicDashboardPanelRenderers,
  createMosaicDashboardDataTableExplorerPanelConfig,
  createMosaicDashboardChartPanelConfig,
  MosaicDashboard,
} from '@sqlrooms/mosaic';

const dashboardSlice = createDashboardFeatureSlices({
  panelRenderers: createDefaultMosaicDashboardPanelRenderers(),
  // Optional: pass chartTypes/chartBuilders to customize Add Chart.
  // Optional: pass addPanelActions to add app-specific menu entries.
});

function Dashboard() {
  return <MosaicDashboard dashboardId="main" />;
}

function addDataTableExplorer(store: RoomStore) {
  store.getState().mosaicDashboard.addPanel(
    'main',
    createMosaicDashboardDataTableExplorerPanelConfig({
      source: {tableName: 'earthquakes'},
    }),
  );
}

function addBoxPlotChart(store: RoomStore) {
  store.getState().mosaicDashboard.addPanel(
    'main',
    createMosaicDashboardChartPanelConfig('Magnitude by Region', {
      chartType: 'box-plot',
      settings: {
        x: 'region',
        y: 'magnitude',
      },
    }),
  );
}
```

Dashboards have a creation-time `layoutType` of either `dock` or `grid`.
Existing persisted dashboards default to `dock`; pass `'grid'` to
`createDashboard(title, 'grid')` or `ensureDashboard(id, title, 'grid')` when
creating a dashboard that should use the scrollable grid renderer. Re-ensuring
an existing dashboard does not convert between layout types.

Dashboard panel sources may specify a `tableName` or trusted `sqlQuery`; when a
panel omits a source it falls back to the dashboard selected table. Panel renderer
definitions and chart builder definitions are runtime-only and intentionally
live outside persisted dashboard config.

`createDashboardFeatureSlices()` composes `createMosaicDashboardSlice()` with
the shared `createBlockSettingsSlice()` from `@sqlrooms/documents`, which is the
slice used by reusable dashboard panel settings. If an app also uses block
documents with settings, install the shared settings slice only once by using
one feature helper plus the other feature's lower-level slice.

### Reset Filters

The package provides hooks and components for resetting cross-filter selections at both dashboard and panel levels:

#### Dashboard-Level Reset

Use `useDashboardResetFilters` to track and reset all filters for a dashboard:

```tsx
import {useDashboardResetFilters} from '@sqlrooms/mosaic';

function DashboardToolbar({dashboardId}: {dashboardId: string}) {
  const {hasActiveFilters, reset} = useDashboardResetFilters({dashboardId});

  return (
    <button onClick={reset} disabled={!hasActiveFilters}>
      Reset All Filters
    </button>
  );
}
```

The hook returns:

- `hasActiveFilters` - Boolean indicating whether any filters are active
- `reset` - Function to clear all filters for the dashboard

#### Panel-Level Reset

Use `usePanelResetFilters` to track and reset only the filters originating from a specific panel:

```tsx
import {
  usePanelResetFilters,
  usePanelClients,
  ResetFiltersButton,
} from '@sqlrooms/mosaic';

function ChartPanelHeader({
  dashboardId,
  panelId,
  selectionName,
}: {
  dashboardId: string;
  panelId: string;
  selectionName: string;
}) {
  const panelClients = usePanelClients(dashboardId, panelId);
  const {hasActiveFilters, reset} = usePanelResetFilters({
    panelClients,
    selectionName,
  });

  return (
    <div className="panel-header">
      <h3>My Chart</h3>
      <ResetFiltersButton disabled={!hasActiveFilters} onClick={reset} />
    </div>
  );
}
```

Panel-level reset requires registering the panel's Mosaic clients. Use `usePanelClientRegistration` in your panel renderer:

```tsx
import {usePanelClientRegistration} from '@sqlrooms/mosaic';

function ChartPanelRenderer({dashboardId, panelId}: PanelProps) {
  const {client} = useMosaicClient({
    selectionName: 'brush',
    query: /* ... */,
  });

  // Register this client so the panel reset button can track its filters
  usePanelClientRegistration(dashboardId, panelId, [client]);

  return <VgPlotChart /* ... */ />;
}
```

#### Reset Filters Button Component

The `ResetFiltersButton` is a pre-styled UI component:

```tsx
import {ResetFiltersButton} from '@sqlrooms/mosaic';

<ResetFiltersButton
  disabled={!hasActiveFilters}
  onClick={reset}
  tooltip="Reset filters" // optional
  className="custom-class" // optional
/>;
```

### Dashboard Stateful Block Adapter

`createMosaicDashboardBlockDefinition` exposes Mosaic dashboards as stateful
block implementations. This lets host packages render the same dashboard
implementation either inside a block host or through an artifact shell created
with `@sqlrooms/artifacts`.

```tsx
import {createArtifactTypeFromStatefulBlock} from '@sqlrooms/artifacts';
import {createMosaicDashboardBlockDefinition} from '@sqlrooms/mosaic';

const dashboardBlockDefinition = createMosaicDashboardBlockDefinition({
  render: DashboardArtifact,
});

export const dashboardArtifactType = createArtifactTypeFromStatefulBlock(
  dashboardBlockDefinition,
);
```

The adapter preserves existing dashboard state in
`mosaicDashboard.config.dashboardsById` and delegates lifecycle work to the
dashboard slice. It includes `MosaicDashboardSettings` by default, and callers
may pass a custom `settings` component when creating the block definition.

### Dashboard AI Tools

`@sqlrooms/mosaic` provides reusable assistant tools for dashboard authoring,
including chart tools, a Data Table Explorer panel tool, and an optional
exploratory `dashboard_agent`. Client apps supply small adapters that map
Mosaic's generic dashboard operations to their store and table metadata.
Agent tools use `intent` for the natural-language objective they should satisfy.
DuckDB-backed hosts can use `createDuckDbDatabaseAiAdapter(store)` for the
database adapter.
Mutation callbacks may return promises, so hosts can route dashboard table and
panel writes through room commands such as `dashboard.set-selected-table`,
`dashboard.add-panel`, `dashboard.update-panel`, and `dashboard.remove-panel`
while preserving the reusable Mosaic AI surface. These commands reject unknown
dashboard IDs instead of implicitly creating dashboard state.

`createDashboardAgentTool` also accepts an optional `authorizeDashboard`
callback. Use it when a host needs to enforce product-specific ownership before
the agent mutates an existing dashboard, for example to prove that an embedded
dashboard belongs to the captured block document. The callback receives the
resolved `dashboardId` and current store state. It runs once before the agent
starts and again immediately before every table or panel mutation.

```ts
import {
  createDashboardAiTools,
  createDuckDbDatabaseAiAdapter,
  MAP_TOOL_KEY,
  type DashboardAiAdapter,
} from '@sqlrooms/mosaic';

const dashboardId = 'dashboard-1';

const databaseAdapter = createDuckDbDatabaseAiAdapter(store);

const dashboardAdapter: DashboardAiAdapter = {
  getSelectedTable: () =>
    store.getState().mosaicDashboard.getDashboard(dashboardId)?.selectedTable,
  getPanels: () =>
    store.getState().mosaicDashboard.getDashboard(dashboardId)?.panels ?? [],
  setSelectedTable: async (tableName) =>
    store.getState().commands.invokeCommand('dashboard.set-selected-table', {
      dashboardId,
      tableName,
    }),
  addPanel: async (panel) =>
    store.getState().commands.invokeCommand('dashboard.add-panel', {
      dashboardId,
      panel,
    }),
  updatePanel: async (panelId, patch) =>
    store.getState().commands.invokeCommand('dashboard.update-panel', {
      dashboardId,
      panelId,
      patch,
    }),
  removePanel: async (panelId) =>
    store.getState().commands.invokeCommand('dashboard.remove-panel', {
      dashboardId,
      panelId,
    }),
  getPanel: (panelId) =>
    store
      .getState()
      .mosaicDashboard.getDashboard(dashboardId)
      ?.panels.find((panel) => panel.id === panelId),
  getPanelIssue: (panelId) =>
    store.getState().mosaicDashboard.getPanelIssue(dashboardId, panelId),
};

const dashboardTools = createDashboardAiTools({
  databaseAdapter,
  dashboardAdapter,
});
```

Dashboard chart tools create new chart panels by default. When the user asks to
edit an existing chart, pass that panel's `panelId` to the same chart tool; the
tool validates that the target is a chart panel and updates its config in place.
If the tool call omits `title`, updates preserve the panel's existing title
instead of renaming it to the default chart title.

Host tools can be added with `extraTools`; they must not reuse built-in
dashboard tool keys. Register geospatial map tools under `MAP_TOOL_KEY` so the
dashboard prompts and tool registration stay aligned. When host tools need
specialized agent guidance, pass `additionalInstructions` to append that
guidance after the built-in agent workflow without replacing it.

Block-document agents can also accept host tools through `extraTools`. Host
tool factories should receive the active block document ID alongside the block
document and database adapters, so apps can add scoped tools such as embedded
stateful blocks without guessing which document the sub-agent is editing.
Block-container tools propagate optional `intent` onto the created block when
the host adapter persists block document state.

### Box Plot Chart Type

The built-in Box Plot chart type (`'box-plot'`) is a specialized chart that uses
a custom renderer instead of Vega-Lite. It calculates quartiles, whiskers, and
outliers directly in DuckDB using SQL queries, then renders them with Observable
Plot primitives. This approach provides better performance and more accurate
statistical calculations than Observable Plot's built-in `boxY` mark.

Box plots support:

- Grouped box plots by categorical variable (x-axis)
- Y-axis brushing for interactive filtering
- Cross-filtering integration with other dashboard charts
- Custom quartile calculation using DuckDB's `quantile_cont` function

The renderer is modular and organized in the `chart-types/box-plot/renderer/`
directory with separate concerns:

- **BoxPlotPanelRenderer.tsx** - Main React component with drag interactions
- **BoxPlotClient.ts** - Mosaic client for SQL-based data queries
- **plot.ts** - Observable Plot rendering logic
- **utils.ts** - Statistical calculations and coordinate transformations
- **constants.ts** - Theme colors and layout constants

### Chart Builder Compound Components

The chart builder UI can be used as a compound component API for flexible composition:

```tsx
import {
  ChartBuilderRoot,
  ChartBuilderTrigger,
  ChartBuilderDialogContent,
  ChartBuilderContent,
} from '@sqlrooms/mosaic';

function MyDashboard() {
  const columns = [...]; // Your table columns

  return (
    <ChartBuilderRoot
      tableName="earthquakes"
      columns={columns}
      onCreateChart={(spec, title) => {
        // Handle chart creation
      }}
      onCreateChartOutput={(output, title) => {
        // Optional: handle non-spec outputs such as dashboard panel chart types.
      }}
    >
      <ChartBuilderTrigger />
      <ChartBuilderDialogContent>
        <ChartBuilderContent />
      </ChartBuilderDialogContent>
    </ChartBuilderRoot>
  );
}
```

Available compound components:

- `ChartBuilderRoot` - Context provider and dialog wrapper
- `ChartBuilderTrigger` - Button to open the dialog
- `ChartBuilderDialogContent` - Dialog content wrapper
- `ChartBuilderContent` - Main chart builder UI (type grid + fields + actions)
- `ChartBuilderTypeGrid` - Chart type selector grid
- `ChartBuilderFields` - Field selector inputs
- `ChartBuilderActions` - Back/Create buttons

For simpler use cases, the legacy `ChartBuilderDialog` component is still available but deprecated.

### Working with Selections

Selections enable cross-filtering between multiple visualizations. You can get or create a named selection from the store:

```tsx
import {useMemo} from 'react';
import {roomStore} from './store';

function FiltersPanel() {
  // Get or create a named selection
  const brush = useMemo(() => {
    const state = roomStore.getState();
    return state.mosaic.getSelection('brush');
  }, []);

  // Use the selection in your visualization
  // When users interact with charts using this selection,
  // all other charts subscribed to 'brush' will update automatically
}
```

Selection types:

- `'crossfilter'` - Multiple values can be selected (default)
- `'single'` - Only one value can be selected at a time
- `'union'` - Union of multiple selections

### VgPlotChart Component

The `VgPlotChart` component renders a Vega-Lite chart using the Mosaic library. It can accept either a Mosaic spec or a pre-built plot element:

```tsx
import {VgPlotChart, Spec} from '@sqlrooms/mosaic';

// Using a spec
const spec: Spec = {
  // Your Vega-Lite specification
};

function MyChart() {
  return <VgPlotChart spec={spec} />;
}

// Or using a pre-built plot element (useful with vg.plot())
import {vg, Selection} from '@sqlrooms/mosaic';

function MyFilterChart() {
  const brush = useMemo(() => {
    const state = roomStore.getState();
    return state.mosaic.getSelection('brush');
  }, []);

  const plot = useMemo(
    () =>
      vg.plot(
        vg.rectY(vg.from('earthquakes', {filterBy: brush}), {
          x: vg.bin('Magnitude', {maxbins: 25}),
          y: vg.count(),
        }),
        vg.intervalX({as: brush}),
      ),
    [brush],
  );

  return <VgPlotChart plot={plot} />;
}
```

## Example Applications

For complete working examples, see:

- **[Mosaic Example](https://github.com/sqlrooms/examples/tree/main/mosaic)** - Basic example showing Vega-Lite charts with cross-filtering
- **[DeckGL + Mosaic Example](https://github.com/sqlrooms/examples/tree/main/deckgl-mosaic)** - Advanced example combining DeckGL maps with Mosaic charts for geospatial data visualization

## Resources

- [Mosaic Documentation](https://idl.uw.edu/mosaic/)
- [Cross-Filter Flights Demo](https://idl.uw.edu/mosaic/examples/flights-200k.html)
- [Vega-Lite Documentation](https://vega.github.io/vega-lite/)
- [DuckDB Documentation](https://duckdb.org/docs/)

## License

MIT
