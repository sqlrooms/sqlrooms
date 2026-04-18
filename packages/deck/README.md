Deck.gl integration for SQLRooms with external JSON specs, DuckDB-backed datasets,
and GeoArrow-first rendering paths.

## Installation

```bash
npm install @sqlrooms/deck @sqlrooms/duckdb @sqlrooms/ui
```

## Quick start

```tsx
import {DeckMap} from '@sqlrooms/deck';

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
      sqlroomsData: 'airports',
      sqlroomsGeometryColumn: 'geom',
      getPosition: '@@=geom',
      getRadius: '@@=6',
      getFillColor: [227, 111, 81, 200],
      radiusMinPixels: 2,
    },
  ],
};

export function AirportsMap() {
  return (
    <DeckMap
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
<DeckMap
  spec={spec}
  datasets={{
    earthquakes: {sqlQuery: 'SELECT * FROM earthquakes'},
    faults: {sqlQuery: 'SELECT * FROM faults'},
  }}
/>
```

Each SQLRooms-managed layer binds to one dataset via `sqlroomsData`.

## Single-dataset sugar

For the common case, `DeckMap` accepts `sqlQuery`, `arrowTable`, or `queryResult`
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
