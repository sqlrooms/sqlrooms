Kepler.gl integration for SQLRooms.

Use this package when you want a **map-first analytics experience** in a SQLRooms app, backed by DuckDB tables and SQL.

## What this package provides

- `createKeplerSlice()` to add Kepler state/actions to your Room store
- `KeplerMapContainer` and `KeplerPlotContainer` for rendering maps/overlays
- `KeplerSidePanels` for layer/filter/interaction UI
- utilities for map config persistence, dataset synchronization, and migration
  from legacy Kepler-owned tabs to artifact-backed tabs

## Selection model

- `createKeplerSlice()` manages Kepler map documents and runtime state keyed by
  map id, but it does not own host-level map selection.
- Render maps with explicit ids, for example `<KeplerMapContainer mapId={id} />`.
- Use `@sqlrooms/artifacts` when an app needs multiple user-managed map tabs;
  artifact state should own the selected map artifact.

## Installation

```bash
npm install @sqlrooms/kepler @sqlrooms/room-shell @sqlrooms/duckdb @sqlrooms/ui
```

## Quick start

```tsx
import {useEffect} from 'react';
import {
  createKeplerSlice,
  KeplerMapContainer,
  KeplerSliceState,
} from '@sqlrooms/kepler';
import {
  createRoomShellSlice,
  createRoomStore,
  RoomShell,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';

type RoomState = RoomShellSliceState & KeplerSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      config: {
        dataSources: [
          {
            type: 'url',
            tableName: 'earthquakes',
            url: 'https://huggingface.co/datasets/sqlrooms/earthquakes/resolve/main/earthquakes.parquet',
          },
        ],
      },
    })(set, get, store),
    ...createKeplerSlice()(set, get, store),
  }),
);

function MapPanel() {
  const mapId = useRoomStore((state) => state.kepler.config.maps[0]?.id);
  const addTableToMap = useRoomStore((state) => state.kepler.addTableToMap);
  const isTableReady = useRoomStore((state) =>
    Boolean(state.db.findTable('earthquakes')),
  );

  useEffect(() => {
    if (!isTableReady || !mapId) return;
    void addTableToMap({
      mapId,
      tableName: 'earthquakes',
      options: {
        autoCreateLayers: true,
        centerMap: true,
      },
    });
  }, [isTableReady, mapId, addTableToMap]);

  if (!mapId) return null;

  return <KeplerMapContainer mapId={mapId} />;
}

export function App() {
  return (
    <RoomShell roomStore={roomStore} className="h-screen">
      <MapPanel />
    </RoomShell>
  );
}
```

## Adding tables to maps

Use `state.kepler.addTableToMap()` to load a DuckDB table into a Kepler map. The
preferred API is an object parameter:

```ts
await state.kepler.addTableToMap({
  mapId,
  tableName: 'earthquakes',
  options: {
    autoCreateLayers: true,
    centerMap: true,
  },
});
```

`tableName` is the SQL table reference to load. It can also be a saved Kepler
dataset id when the configured table-selection policy can resolve that id back
to a DuckDB table.

For normal add-table flows, omit `datasetId`. SQLRooms derives the persisted
Kepler dataset id from the table-selection policy:

```ts
await state.kepler.addTableToMap({
  mapId,
  tableName: 'main.places',
});
```

Only pass `datasetId` when you need to load a table under an existing Kepler
`dataId`, such as when restoring a saved map config:

```ts
await state.kepler.addTableToMap({
  mapId,
  tableName: savedDataId,
  options: {
    autoCreateLayers: false,
    centerMap: false,
  },
  datasetId: savedDataId,
});
```

The older positional signature is still accepted for compatibility, but new code
should use the object form so the table reference, Kepler options, config, and
dataset-id override remain clear at the call site.

An optional `signal: AbortSignal` lets a caller discard a load's results if it
is cancelled before they are applied. The promise resolves without adding data;
the underlying database query is not cancelled. Overrides of `addTableToMap`
should forward or honor this signal. The positional form accepts it in its final
load-options argument.

## Common customization

### Restoring saved maps

Use `kepler.setConfig(savedConfig)` to replay configuration received after room
initialization, then `await kepler.waitForConfigRestore()` to wait for the
restore operation. Initial configuration and later restores both load datasets
referenced by pending layers, filters, and tooltips for every registered map;
mounting a map component is not required.

A newer restore cancels results from earlier dataset-sync requests. Explicit
`addTableToMap` calls remain independent of restores unless the caller supplies
a cancellation signal; restoring another map does not discard a requested table.

If a referenced table is unavailable or fails to load, the map's saved config is
preserved. Deferred Kepler actions cannot replace it with a partially restored
config. Refresh the available tables and call `await kepler.syncKeplerDatasets()`
to retry. Other, fully restored maps continue to autosave normally, including
intentional deletion of all their layers.

`waitForConfigRestore()` does not guarantee that unavailable datasets have loaded.
Persistence protection is based on each map's pending config, so it remains in
effect after that promise resolves. Edits to an incomplete map do not replace
its saved config until its pending config is resolved.

### Appearance

Pass options to `createKeplerSlice()`:

```ts
import {createKeplerTheme, type KeplerThemeOverrides} from '@sqlrooms/kepler';

createKeplerSlice({
  basicKeplerProps: {
    mapboxApiAccessToken: import.meta.env.VITE_MAPBOX_TOKEN,
  },
  keplerTheme: createKeplerTheme({
    modalOverLayZ: 40,
  } satisfies KeplerThemeOverrides),
  modalPortalTarget: 'body',
  actionLogging: false,
});
```

Notes:

- `basicKeplerProps` is for base Kepler registration/component props.
- `keplerTheme` (optional) sets the theme passed to Kepler `ThemeProvider`.
- `modalPortalTarget` controls modal portal placement: `'container'` (default)
  or `'body'`.

### Table selection and dataset ids

`tableSelection` controls which DuckDB tables Kepler exposes and how those
tables are represented in persisted Kepler layer and filter config.

```ts
createKeplerSlice({
  tableSelection: {
    defaultDbSchema: {
      database: 'project',
      schema: 'main',
    },
    includeTable: (table) => table.table.database === 'project',
  },
});
```

By default, tables in `defaultDbSchema` use bare dataset ids such as `places`.
Tables outside that database/schema use qualified SQL table references. This
keeps common main-schema project tables readable while preserving enough
identity for tables from other schemas.

Use `includeTable` to hide tables from Kepler's Add Layer UI and to skip matching
saved dataset ids during dataset synchronization. Host apps commonly use this to
hide attached databases that will not be available when a project is reopened.

If the default dataset-id policy is not right for your app, provide both
`getDatasetIdForTable` and `findTableForDatasetId` so new layers and restored
layers agree on the same identity scheme:

```ts
createKeplerSlice({
  tableSelection: {
    getDatasetIdForTable: (table) =>
      `${table.table.schema}:${table.table.table}`,
    findTableForDatasetId: (tables, datasetId) => {
      const [schema, tableName] = datasetId.split(':');
      return tables.find(
        (table) =>
          table.table.schema === schema && table.table.table === tableName,
      );
    },
    getTableLabel: (table) =>
      [table.table.schema, table.table.table].filter(Boolean).join('.'),
  },
});
```

`getTableLabel` only affects display labels in Kepler table selectors. It does
not change persisted dataset ids.

## Related packages

- `@sqlrooms/artifacts` for artifact-backed map tabs
- `@sqlrooms/kepler-config` for Zod schemas used by persisted Kepler config
- `@sqlrooms/room-shell` for Room store composition and UI shell
- `@sqlrooms/duckdb` for DuckDB-backed table loading/querying

## Examples

- Kepler example app: https://github.com/sqlrooms/examples/tree/main/kepler
