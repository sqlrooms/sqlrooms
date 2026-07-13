Deck.gl integration for SQLRooms with JSON-driven map specs, dataset registry
binding, DuckDB-backed or in-memory Arrow datasets, and GeoArrow-first geometry
preparation.

## Map resources and dashboard adapters

Worksheet maps are first-class `deckMaps` resources. The root package export
contains the resource slice, renderer, settings, direct DuckDB data adapter,
and resource orchestration APIs. It does not require Mosaic.

Mosaic dashboard panel support is opt-in through `@sqlrooms/deck/mosaic`.
Dashboard panels keep their panel storage, query clients, cross-filter
selection, and issue translation inside that adapter boundary.

`DeckMapSettingsPanel` is the shared host-neutral editor for both surfaces. It
receives a map config, selected table, available tables, and edit callbacks;
worksheet resources and Mosaic panels only adapt their respective stores to
that contract. Layer, binding, style, extrusion, and code-view controls therefore
stay consistent without putting Mosaic APIs in the worksheet settings path.

Use `getDeckMapDataPolicy(...)` to resolve a map config into the exported
`DeckMapDataPolicy` runtime row-limit policy.

Worksheet maps deliberately use independent selection semantics. Their direct
data adapter executes each configured SQL/table dataset through the room's
DuckDB connector and neither reads nor publishes Mosaic selections. This drops
the old incidental intra-map cross-filtering between datasets; a future
host-neutral selection adapter can add that behavior without changing map
resource ownership.

## Installation

```bash
npm install @sqlrooms/deck @sqlrooms/duckdb @sqlrooms/ui
```

## What This Package Does

`@sqlrooms/deck` is the JSON-spec bridge between SQLRooms data and deck.gl:

- render a DeckGL map from a serializable `DeckJsonMap` spec
- bind one or more datasets through a `datasets` registry
- generate starter JSON specs from datasets with `createDeckJsonSpecFromDatasets`
- validate SQLRooms-specific layer bindings under `_sqlroomsBinding`
- prepare geometry for GeoArrow-native layers from
  [`@geoarrow/deck.gl-geoarrow`](https://github.com/geoarrow/deck.gl-geoarrow)
  and GeoJSON fallback layers
- support shared declarative color scales through `@sqlrooms/color-scales`

Use this package when you want deck.gl layers to be driven by a JSON-like spec
instead of hand-constructing deck layer instances in React code.

## Quick Start

```tsx
import {DeckJsonMap} from '@sqlrooms/deck';

const spec = {
  initialViewState: {
    longitude: -122.4,
    latitude: 37.74,
    zoom: 10,
    pitch: 0,
    bearing: 0,
  },
  controller: true,
  layers: [
    {
      '@@type': 'GeoArrowScatterplotLayer',
      id: 'airports',
      _sqlroomsBinding: {
        dataset: 'airports',
        geometryColumn: 'geom',
      },
      getFillColor: {
        '@@function': 'colorScale',
        field: 'scalerank',
        type: 'sequential',
        scheme: 'YlOrRd',
        domain: 'auto',
      },
      getRadius: '@@=6',
      radiusMinPixels: 2,
    },
  ],
};

export function AirportsMap() {
  return (
    <DeckJsonMap
      spec={spec}
      datasets={{
        airports: {
          sqlQuery:
            'SELECT name, abbrev, scalerank, ST_AsWKB(geom) AS geom FROM airports',
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      }}
      mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
    />
  );
}
```

## Auto Spec Generation

If you want a starter JSON spec instead of writing every layer manually, use
`createDeckJsonSpecFromDatasets(...)`:

```tsx
import {createDeckJsonSpecFromDatasets, DeckJsonMap} from '@sqlrooms/deck';

const datasets = {
  earthquakes: {
    arrowTable,
    geometryColumn: 'geom',
    geometryEncodingHint: 'wkb',
  },
};

const spec = createDeckJsonSpecFromDatasets({datasets});
```

By default, the helper is conservative:

- point / multipoint -> `GeoArrowScatterplotLayer`
- linestring / multilinestring -> `GeoArrowPathLayer`
- polygon / multipolygon -> `GeoArrowPolygonLayer`
- mixed, unknown, or unsupported -> `GeoJsonLayer`

You can provide semantic hints for special layers:

```tsx
const spec = createDeckJsonSpecFromDatasets({
  datasets,
  hints: {
    earthquakes: {prefer: 'heatmap'},
    trips: {
      type: 'GeoArrowTripsLayer',
      timestampColumn: 'timestamps',
    },
    flows: {
      type: 'GeoArrowArcLayer',
      sourceGeometryColumn: 'source_geom',
      targetGeometryColumn: 'target_geom',
    },
    hexes: {
      type: 'GeoArrowH3HexagonLayer',
      hexagonColumn: 'h3',
    },
  },
});
```

## Mosaic Dashboard Renderer

`@sqlrooms/deck` can contribute a `deck-json-map` panel renderer to
`@sqlrooms/mosaic` dashboards without making the Mosaic package depend on
deck.gl or MapLibre. Pass the renderer when creating the Mosaic dashboard
slice.

The dashboard renderer exposes `DeckMapDashboardSettings` through its renderer
definition. `DeckMapBlockSettings` is also exported for block-document hosts
that embed maps as stateful blocks.

```tsx
import {
  createDeckMapDashboardPanelConfig,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  deckMapDashboardPanelRenderer,
} from '@sqlrooms/deck';
import {
  createDefaultMosaicDashboardPanelRenderers,
  createMosaicDashboardSlice,
  MosaicDashboard,
} from '@sqlrooms/mosaic';

const dashboardSlice = createMosaicDashboardSlice({
  panelRenderers: createDefaultMosaicDashboardPanelRenderers({
    [DECK_MAP_DASHBOARD_PANEL_TYPE]: deckMapDashboardPanelRenderer,
  }),
});

function Dashboard() {
  return <MosaicDashboard dashboardId="geo" />;
}

const mapPanel = createDeckMapDashboardPanelConfig({
  title: 'Earthquakes map',
  spec: {
    initialViewState: {longitude: -119.5, latitude: 37, zoom: 4.5},
    layers: [
      {
        '@@type': 'GeoArrowScatterplotLayer',
        id: 'earthquakes',
        _sqlroomsBinding: {dataset: 'earthquakes'},
      },
    ],
  },
  datasets: {
    earthquakes: {
      source: {
        sqlQuery:
          'SELECT *, ST_AsWKB(ST_Point(Longitude, Latitude)) AS geom FROM earthquakes',
      },
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkb',
    },
  },
  fitToData: {
    dataset: 'earthquakes',
    longitudeColumn: 'Longitude',
    latitudeColumn: 'Latitude',
    padding: 40,
    maxZoom: 12,
  },
});
```

The dashboard renderer uses `useMosaicClient`, receives Arrow tables directly,
and passes them to `DeckJsonMap` as Arrow-backed datasets. Dataset sources fall
back from dataset-level source, to panel source, to the dashboard selected
table. When `fitToData` is provided, the renderer asks DuckDB Spatial for the
dataset extent using the declared longitude/latitude columns and fits the
initial map view once, instead of inferring bounds from the loaded Arrow
payload in React.

Use `createDeckMapPanelFromNativeConfig(...)` when a host surface already has a
native Deck map config, for example from AI tooling, and needs the same
dashboard-compatible `deck-json-map` panel shape that the dashboard map tool
creates.

### Config Mode

The optional `configMode` field (`'basic' | 'custom'`) on
`DeckMapDashboardPanelConfig` controls how the map was authored and what editing
UI is available:

- **`'basic'`** (default when absent) — the config uses only properties that the
  settings panel can represent (layer type, color scale, radius, geometry
  bindings). The UI settings panel is enabled for user tweaks.
- **`'custom'`** — the config may use any deck.gl JSON props, including those not
  representable in the UI configurator. Dashboard and document map settings keep
  the basic controls disabled so dataset or layer edits cannot rewrite the authored
  config.

AI tools set this field automatically based on request complexity.

## Embeddable Map Blocks

Host applications that expose document-like block surfaces can render maps
as durable resources without creating a dashboard. Compose
`createDeckMapsSlice()` into the room store, call
`ensureDeckMapResourceState(...)` for a durable map id, and render it with
`DeckMapBlockRenderer`.

Runtime issue recovery can call `deckMaps.clearMapIssue(mapId, kind)` to clear
only a matching issue kind; omit `kind` when the map state should clear any
stale issue. Replacing a map config clears its prior render issue, while data
issues remain until the corresponding dataset recovery is reported.

Hosts that expose direct worksheet-map AI capability should include
`getDeckMapResourceAiInstructions()` in the responsible agent and tool
instructions. `createOrUpdateDeckMapResource(...)` validates the fully merged
resource before any durable block or map write: each dataset needs a
`source.tableName` or `source.sqlQuery`, and each layer needs an explicit
`_sqlroomsBinding.dataset`. Use `mergeDeckMapResourceConfigPatch(...)` in host
preparation so sparse updates retain durable dataset sources and layers.

`createDeckMapBlockDocumentType(...)` and
`createDeckMapBlockDocumentCommandType(...)` provide the reusable registration
metadata for block-document hosts. They register a `map` stateful block with
resizable height, scroll-modifier behavior, map settings, and owned state
creation wired through `ensureDeckMapResourceState(...)`:

```ts
import {
  createDeckMapBlockDocumentCommandType,
  createDeckMapBlockDocumentType,
} from '@sqlrooms/deck';

const mapBlockType = createDeckMapBlockDocumentType({
  getState: () => roomStore.getState(),
  defaultTitle: 'Embedded Map',
});

const mapCommandType = createDeckMapBlockDocumentCommandType({
  defaultTitle: 'Embedded Map',
});
```

Hosts still own renderer registration, deletion cleanup, and product-specific
side effects. Use `afterEnsureState` for app-local metadata updates after the
map resource is created.

`createOrUpdateDeckMapResource(...)` is the durable orchestration helper for
commands and AI tools. It uses only resource and block callbacks:

```ts
import {createOrUpdateDeckMapResource} from '@sqlrooms/deck';

const result = await createOrUpdateDeckMapResource(
  {
    ensureBlockDocument,
    findMapBlock,
    findMap,
    createMapBlock,
    updateBlockMetadata,
    ensureMap,
    writeMap,
    findTable,
    prepareConfig,
  },
  {
    blockDocumentId,
    mapId,
    config,
    tableName,
    title,
    intent,
  },
);
```

On create, callers must provide either `mapId` or `createMapId`. On update, the
default behavior is intentionally strict: missing map blocks and SQL-only
dataset sources without a resolvable `tableName` throw so command paths do not
silently retarget stale IDs. AI create flows can opt into
`missingMapBlockBehavior: 'create'`; a supplied `mapId` is retained, with
`createMapId` used only as its fallback.

Title handling is conservative for Ask AI edits: when `title` is omitted,
`createOrUpdateDeckMapResource(...)` preserves the existing non-blank block
caption or resource title. Passing an explicit `title` updates the durable map
title and uses it as the default block caption. Block metadata is written only
after the map write succeeds.

Map authoring helpers such as `normalizeDeckMapPointConfig(...)`,
`normalizeDeckMapFillColor(...)`, `regenerateMapConfigForTable(...)`, and
dataset-source helpers such as `getFirstDatasetSourceTableName(...)` are
exported so hosts can normalize AI-authored configs before calling
`createOrUpdateDeckMapResource(...)`. `normalizeDeckMapPointConfig(...)` only adds
the standard lon/lat point transform to table-backed datasets that do not
already declare `geometryColumn`, `source.sqlQuery`, or `source.transformSql`
and whose resolved table does not expose a native geometry column; native
geometry, polygon, line, and pre-transformed datasets are preserved.
When regenerating a map with one existing dataset, its dataset ID is retained
and geometry bindings are refreshed so custom layers continue to address the
same dataset after a table switch. Non-geospatial tables and multi-dataset maps
return the existing config unchanged so callers can keep the current selection
when a safe target cannot be inferred. Maps without datasets adopt the generated
dataset and layer spec after a valid table is selected.

## Core Concepts

### `DeckJsonMap`

`DeckJsonMap` is the main React component exported by this package. It takes:

- `spec`: a JSON-like deck.gl spec object or JSON string
- `datasets`: a dataset registry keyed by dataset id
- `interleaved`: when true, deck layers render in MapLibre's own WebGL context instead of a separate overlay canvas. This halves the number of WebGL contexts per map panel (from 2 to 1), which matters because browsers limit active contexts to ~8–16 per page. Default: `true`
- `deckProps`: runtime-only deck props such as `getTooltip`, `onHover`, `onClick`
- `mapProps`: runtime-only MapLibre props
- `showLegends`: whether SQLRooms-generated color legends should render

`spec` stays serializable; callbacks and runtime behavior belong in `deckProps`
or `mapProps`.

By default, deck.gl renders interleaved into MapLibre's layer stack, sharing a
single WebGL context. This allows deck layers to be inserted between basemap
layers (e.g. render points under map labels) and reduces WebGL context usage.
Set `interleaved` to `false` to render deck layers in a separate overlay canvas
on top of all basemap layers (uses an additional WebGL context per map).

```tsx
{
  /* Default (interleaved): */
}
<DeckJsonMap spec={spec} datasets={datasets} />;

{
  /* Opt out to separate overlay canvas: */
}
<DeckJsonMap spec={spec} datasets={datasets} interleaved={false} />;
```

### Dataset Registry

Each SQLRooms-managed layer binds to exactly one dataset through
`_sqlroomsBinding.dataset`.

```tsx
<DeckJsonMap
  spec={spec}
  datasets={{
    earthquakes: {tableName: 'earthquakes'},
    faults: {tableName: 'faults'},
  }}
/>
```

Dataset ids are layer-binding labels. Internally, prepared geometry is cached
by the resolved data identity, not by dataset id, so multiple maps or layers
can reuse the same preparation work when they point at the same table/query.

### Dataset Input Kinds

Each dataset entry is one of:

```tsx
datasets={{
  airports: {
    sqlQuery: 'SELECT * FROM airports',
    geometryColumn: 'geom',
    geometryEncodingHint: 'wkb',
  },
  earthquakePoints: {
    tableName: 'earthquakes',
    transformSql: `
      SELECT *, ST_AsWKB(ST_Point(longitude, latitude)) AS geom
      FROM __sqlrooms_source
      WHERE longitude IS NOT NULL AND latitude IS NOT NULL
    `,
    geometryColumn: 'geom',
    geometryEncodingHint: 'wkb',
  },
  faults: {
    tableName: 'faults',
    geometryColumn: 'geom',
    geometryEncodingHint: 'wkb',
  },
  preview: {
    arrowTable,
    geometryColumn: 'geom',
    geometryEncodingHint: 'wkb',
  },
}}
```

- `sqlQuery`
  Runs a standalone literal query through the DuckDB slice execution path. This
  query is not rewritten by dashboard table selection.
- `tableName`
  Reads directly from a table or schema-qualified table reference.
- `tableName` + `transformSql`
  Reads a structured table source through a SQL transform. `transformSql` must
  be a complete `SELECT` statement that reads from SQLRooms' reserved
  `__sqlrooms_source` relation. SQLRooms binds that relation to the quoted
  `tableName` at execution time, so dashboards can swap the table source
  without editing authored SQL.
- `arrowTable`
  Uses an already available Apache Arrow table. This is the right input for
  Arrow-native SQLRooms hooks such as `useSql` and `useMosaicClient`.

For in-memory Arrow datasets, `arrowTable` may be temporarily `undefined` while
data is still loading. `DeckJsonMap` will keep rendering the basemap and treat
that dataset as loading until a table is provided.

Use `onDatasetStatesChange` when the surrounding UI needs dataset loading,
ready, or error state:

```tsx
<DeckJsonMap
  spec={spec}
  datasets={datasets}
  onDatasetStatesChange={(states) => setDatasetStates(states)}
/>
```

## SQLRooms Layer Bindings

SQLRooms-specific layer metadata lives under `_sqlroomsBinding`:

```tsx
{
  '@@type': 'GeoArrowScatterplotLayer',
  id: 'earthquakes',
  _sqlroomsBinding: {
    dataset: 'earthquakes',
    geometryColumn: 'geom',
    geometryEncodingHint: 'wkb',
  },
  getFillColor: {
    '@@function': 'colorScale',
    field: 'Magnitude',
    type: 'sequential',
    scheme: 'YlOrRd',
    domain: 'auto',
  },
}
```

Currently supported SQLRooms binding fields are:

- `dataset`: binds the layer to one dataset id
- `geometryColumn`: overrides geometry column detection for that layer
- `geometryEncodingHint`: helps geometry detection when the source table needs it
- `sourceGeometryColumn`: source point geometry for `GeoArrowArcLayer`
- `targetGeometryColumn`: target point geometry for `GeoArrowArcLayer`
- `timestampColumn`: timestamp list column for `GeoArrowTripsLayer`
- `hexagonColumn`: H3 index column for `GeoArrowH3HexagonLayer`

The surrounding deck spec remains intentionally loose so normal deck.gl JSON
props still pass through, while `_sqlroomsBinding` is validated strictly.

## Color Scales and Legends

You can ask SQLRooms to derive colors from a field with the
`colorScale` JSON function instead of writing long `@@=` color
expressions:

```tsx
getFillColor: {
  '@@function': 'colorScale',
  field: 'Magnitude',
  type: 'sequential',
  scheme: 'YlOrRd',
  domain: 'auto',
  clamp: true,
}
```

Discrete numeric palettes are supported too:

```tsx
getFillColor: {
  '@@function': 'colorScale',
  field: 'Magnitude',
  type: 'quantize',
  scheme: 'PuBuGn',
  domain: [0, 8],
  bins: 5,
}
```

`DeckJsonMap` renders SQLRooms-generated legends by default for layers that use
`colorScale`. To disable them globally:

```tsx
<DeckJsonMap spec={spec} datasets={datasets} showLegends={false} />
```

To override the title:

```tsx
getFillColor: {
  '@@function': 'colorScale',
  field: 'Magnitude',
  type: 'sequential',
  scheme: 'YlOrRd',
  domain: 'auto',
  legend: {
    title: 'Magnitude (Mw)',
  },
}
```

Supported scale types come from `@sqlrooms/color-scales`:

- `sequential`
- `diverging`
- `quantize`
- `quantile`
- `threshold`
- `categorical`

When `domain` is set to `'auto'`, the domain is computed from the currently
bound dataset, so colors may shift as filters change. Use explicit domains when
you want colors to stay stable across filtering.

## Geometry Preparation

`prepareDeckDataset(...)` is the deck-specific preparation step behind the
scenes. It accepts resolved Arrow tables with geometry stored as:

- native GeoArrow
- WKB / GeoArrow WKB
- WKT / GeoArrow WKT

It then produces canonical deck-facing geometry outputs for:

- GeoArrow-native layers such as `GeoArrowScatterplotLayer`
- GeoJSON-binary fallback layers such as `GeoJsonLayer`

Specialized layers such as `GeoArrowArcLayer`, `GeoArrowTripsLayer`, and
`GeoArrowH3HexagonLayer` reuse the prepared table but bind additional
configured columns on top for source/target geometry,
timestamps, or index cells.

This work is cached internally in a module-global prepared dataset store. That
cache is separate from any upstream query cache:

- Mosaic-driven queries already benefit from Mosaic's own query cache
- DuckDB SQL datasets still use the DuckDB slice execution path

Deck caches only the expensive geometry preparation layer on top.

## Supported Layers

The current curated layer set is:

- `GeoArrowScatterplotLayer`
- `GeoArrowHeatmapLayer`
- `GeoArrowColumnLayer`
- `GeoArrowPathLayer`
- `GeoArrowPolygonLayer`
- `GeoArrowSolidPolygonLayer`
- `GeoArrowArcLayer`
- `GeoArrowTripsLayer`
- `GeoArrowH3HexagonLayer`
- `GeoJsonLayer`

GeoArrow-native geometry columns are the efficient path. WKB/WKT geometry falls
back to decoding and GeoJSON-binary preparation, with promotion available
for point-focused GeoArrow layers such as `GeoArrowScatterplotLayer`,
`GeoArrowHeatmapLayer`, and `GeoArrowColumnLayer`, plus polygon promotion for
`GeoArrowPolygonLayer` and `GeoArrowSolidPolygonLayer`.

The GeoArrow layer implementations themselves come from
[`@geoarrow/deck.gl-geoarrow`](https://github.com/geoarrow/deck.gl-geoarrow).

When querying DuckDB spatial `GEOMETRY` columns directly, convert them first
with `ST_AsWKB(...)` or `ST_AsText(...)`. DuckDB's internal geometry payload is
not the same as standard WKB.

## Runtime Props and Children

Keep the spec serializable, then pass runtime behavior separately:

- `deckProps` for deck callbacks such as `getTooltip`, `onHover`, `onClick`
- `mapProps` for MapLibre props such as `projection`
- `children` for controls, overlays, and popups rendered inside the map

This lets the spec stay stable for storage, validation, and future AI-assisted
generation while still supporting interactive React behavior at runtime.
