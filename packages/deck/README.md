Deck.gl integration for SQLRooms with JSON-driven map specs, dataset registry
binding, DuckDB-backed or in-memory Arrow datasets, and GeoArrow-first geometry
preparation.

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
  [`@geoarrow/deck.gl-layers`](https://github.com/geoarrow/deck.gl-layers)
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

## Core Concepts

### `DeckJsonMap`

`DeckJsonMap` is the main React component exported by this package. It takes:

- `spec`: a JSON-like deck.gl spec object or JSON string
- `datasets`: a dataset registry keyed by dataset id
- `deckProps`: runtime-only deck props such as `getTooltip`, `onHover`, `onClick`
- `mapProps`: runtime-only MapLibre props
- `showLegends`: whether SQLRooms-generated color legends should render

`spec` stays serializable; callbacks and runtime behavior belong in `deckProps`
or `mapProps`.

### Dataset Registry

Each SQLRooms-managed layer binds to exactly one dataset through
`_sqlroomsBinding.dataset`.

```tsx
<DeckJsonMap
  spec={spec}
  datasets={{
    earthquakes: {sqlQuery: 'SELECT * FROM earthquakes'},
    faults: {sqlQuery: 'SELECT * FROM faults'},
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
  preview: {
    arrowTable,
    geometryColumn: 'geom',
    geometryEncodingHint: 'wkb',
  },
}}
```

- `sqlQuery`
  Runs through the DuckDB slice execution path.
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
[`@geoarrow/deck.gl-layers`](https://github.com/geoarrow/deck.gl-layers).

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
