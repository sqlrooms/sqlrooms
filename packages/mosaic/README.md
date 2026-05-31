This package is part of the SQLRooms framework. It provides React components and hooks for integrating [Mosaic](https://idl.uw.edu/mosaic/) - a visualization library for data exploration and analysis - into SQLRooms applications.

## Overview

Mosaic is a JavaScript library for data visualization and analysis developed by the [Interactive Data Lab (IDL)](https://idl.uw.edu/) at the University of Washington. It combines the expressiveness of declarative visualization grammars with the power of reactive programming and SQL queries.

One of Mosaic's powerful features is its cross-filtering capability powered by DuckDB, allowing users to interactively filter and explore large datasets with millions of records directly in the browser. This enables creating interactive dashboards where selections in one chart automatically filter data in other charts. For an example of this functionality, see the [Cross-Filter Flights demo](https://idl.uw.edu/mosaic/examples/flights-200k.html) which demonstrates interactive filtering across multiple visualizations of a 200,000-record flight dataset.

This package provides:

- React components for rendering Vega-Lite charts using Mosaic
- Hooks for integrating Mosaic with DuckDB in SQLRooms applications
- Utilities for working with Mosaic specifications

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

### Data Table Explorer Primitives

The Data Table Explorer primitives let you build a Quake-style cross-filtered
table with per-column summaries on top of `MosaicSlice`.

```tsx
import {DataTableExplorer} from '@sqlrooms/mosaic';
import {ScrollArea} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {useRoomStore} from './store';

function EarthquakeExplorer() {
  const mosaic = useRoomStore((state) => state.mosaic);
  const brush = useMemo(() => mosaic.getSelection('brush'), [mosaic]);

  return (
    <DataTableExplorer tableName="earthquakes" selection={brush} pageSize={25}>
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

For the common case, prefer the compound `DataTableExplorer` API.
`useDataTableExplorer` is still available when you need direct access to the
explorer state for custom layout, sizing, or advanced composition.

`DataTableBlockRenderer` wraps the same explorer UI as a stateful block
renderer for `@sqlrooms/documents` block documents. Register it with a
host-provided stateful block type such as `data-table` when a document or
worksheet surface should embed an interactive Data Table Explorer directly.

### Mosaic Dashboard Panels

`MosaicDashboard` is a compound dashboard surface backed by generic dashboard
panels instead of a chart-only list. Configure supported panel renderers and
runtime add-panel actions when creating the dashboard slice.

```tsx
import {
  createDefaultMosaicDashboardPanelRenderers,
  createMosaicDashboardDataTableExplorerPanelConfig,
  createMosaicDashboardChartPanelConfig,
  createMosaicDashboardSlice,
  MosaicDashboard,
} from '@sqlrooms/mosaic';

const dashboardSlice = createMosaicDashboardSlice({
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
dashboard slice.

### Dashboard AI Tools

`@sqlrooms/mosaic` provides reusable assistant tools for dashboard authoring,
including chart tools, Data Table Explorer/text panel tools, panel management tools, and an
optional exploratory `dashboard_agent`. Client apps supply a small adapter that
maps Mosaic's generic dashboard operations to their store, artifact model, table
metadata, and AI run context. When an AI run context is present, implicit
dashboard targeting should resolve only a primary dashboard context item;
reference-only dashboard artifacts should require an explicit `artifactId`.

```ts
import {
  createDashboardAiTools,
  MAP_TOOL_KEY,
  type DashboardAiAdapter,
} from '@sqlrooms/mosaic';

const adapter: DashboardAiAdapter<AppState> = {
  getTables: (state) => state.db.tables,
  hasRunContext: (state, context) => hasAiRunContext(context),
  resolveContextDashboardArtifactId: (state, context) =>
    getPrimaryDashboardArtifactIdFromRunContext(context, state),
  makeDashboardPrimaryForRun: (state, artifactId, context) =>
    makeArtifactPrimaryForAiRun(artifactId, context),
  getCurrentDashboardArtifactId: (state) =>
    state.dashboard.getCurrentDashboardArtifactId(),
  createDashboardArtifact: (state, title, layoutType) =>
    state.dashboard.createDashboardArtifact(title, layoutType),
  isDashboardArtifact: (state, artifactId) =>
    state.artifacts.getArtifact(artifactId)?.type === 'dashboard',
  setCurrentArtifact: (state, artifactId) =>
    state.artifacts.setCurrentArtifact(artifactId),
  ensureDashboard: (state, dashboardId) =>
    state.dashboard.ensureDashboardArtifact(dashboardId),
  getDashboard: (state, dashboardId) =>
    state.mosaicDashboard.getDashboard(dashboardId),
  setSelectedTable: (state, dashboardId, tableName) =>
    state.mosaicDashboard.setSelectedTable(dashboardId, tableName),
  addPanel: (state, dashboardId, panel) =>
    state.mosaicDashboard.addPanel(dashboardId, panel),
  updatePanel: (state, dashboardId, panelId, patch) =>
    state.mosaicDashboard.updatePanel(dashboardId, panelId, patch),
  removePanel: (state, dashboardId, panelId) =>
    state.mosaicDashboard.removePanel(dashboardId, panelId),
};

const dashboardTools = createDashboardAiTools({store, adapter});
```

Host tools can be added with `extraTools`; they must not reuse built-in
dashboard tool keys. Register geospatial map tools under `MAP_TOOL_KEY` so the
dashboard prompts and tool registration stay aligned.

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
