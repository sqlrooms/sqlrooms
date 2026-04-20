Deck.gl integration for SQLRooms with external JSON specs, DuckDB-backed datasets,
and GeoArrow-first rendering paths.

## Installation

```bash
npm install @sqlrooms/deck @sqlrooms/duckdb @sqlrooms/ui
```

## Quick start

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
      _sqlrooms: {
        dataset: 'airports',
        geometryColumn: 'geom',
        colorScale: {
          field: 'scalerank',
          type: 'sequential',
          scheme: 'YlOrRd',
          domain: 'auto',
        },
      },
      getPosition: '@@=geom',
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

## Dataset registry

Use `datasets` for multi-layer and multi-dataset specs:

```tsx
<DeckJsonMap
  spec={spec}
  datasets={{
    earthquakes: {sqlQuery: 'SELECT * FROM earthquakes'},
    faults: {sqlQuery: 'SELECT * FROM faults'},
  }}
/>
```

Each SQLRooms-managed layer binds to one dataset via `_sqlrooms.dataset`.

## Color scales

Instead of writing long `@@=` color expressions, you can ask SQLRooms to derive
colors from a field:

```tsx
{
  '@@type': 'GeoArrowScatterplotLayer',
  id: 'earthquakes',
  _sqlrooms: {
    dataset: 'earthquakes',
    colorScale: {
      field: 'Magnitude',
      type: 'sequential',
      scheme: 'YlOrRd',
      domain: 'auto',
      clamp: true,
    },
  },
}
```

Discrete numeric palettes are available too:

```tsx
colorScale: {
  field: 'Magnitude',
  type: 'quantize',
  scheme: 'PuBuGn',
  domain: [0, 8],
  bins: 5,
}
```

By default, `DeckJsonMap` renders a small legend overlay for layers that use
`_sqlrooms.colorScale`. To hide it or override the title:

```tsx
colorScale: {
  field: 'Magnitude',
  type: 'sequential',
  scheme: 'YlOrRd',
  domain: 'auto',
  legend: {
    title: 'Magnitude (Mw)',
  },
}
```

or

```tsx
<DeckJsonMap spec={spec} datasets={datasets} showLegends={false} />
```

Supported scale types:

- `sequential`: continuous sequential/cyclical interpolators from `d3-scale-chromatic`
- `diverging`: continuous diverging interpolators from `d3-scale-chromatic`
- `quantize`: equal-width discrete bins using numeric scheme families such as `Blues`, `PuBuGn`, `RdYlBu`
- `quantile`: equal-count discrete bins using numeric scheme families
- `threshold`: explicit threshold bins using numeric scheme families
- `categorical`: categorical palettes such as `Category10`, `Observable10`, `Tableau10`, `Set3`

When `domain` is set to `'auto'`, the scale domain is computed from the currently
bound dataset, so colors may shift as filters change.

## Single-dataset sugar

For the common case, `DeckJsonMap` accepts `sqlQuery`, `arrowTable`, or `queryResult`
directly and treats them as `datasets.default`.

## Runtime props

Keep serializable map specs in `spec`, then pass runtime behavior separately:

- use `deckProps` for callbacks like `onHover`, `onClick`, and `getTooltip`
- use `mapProps` for MapLibre props such as `projection`
- use `children` for map controls and popups rendered inside the underlying map

## Supported layers

- `GeoArrowScatterplotLayer`
- `GeoArrowPathLayer`
- `GeoArrowSolidPolygonLayer`
- `GeoJsonLayer`

GeoArrow-native geometry columns are the efficient path. WKB/WKT geometry falls
back to geometry decoding and binary GeoJSON preparation, with point promotion
available for point-focused GeoArrow layers.

When querying DuckDB spatial `GEOMETRY` columns directly, convert them first with
`ST_AsWKB(...)` or `ST_AsText(...)`. DuckDB's internal geometry payload is not
the same as standard WKB.
