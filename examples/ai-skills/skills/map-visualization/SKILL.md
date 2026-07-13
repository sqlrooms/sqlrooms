# Map Visualization

Create Kepler.gl map layers from tables, animate them over time.

## When to Use

After data analysis when results have geographic dimensions (lat/lon, geometry,
H3 cells) and need to be visualized on a map.

All map operations go through `executeApi` with `apiName: "executeCommand"`. See the executeApi tool description for envelope shape.

## Commands at a glance

| command                  | purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `data.classify`          | Compute color breaks / unique values for data-driven coloring. |
| `map.create-layer`       | Add a layer (point, h3, arc, trip, geojson, …) to the map.     |
| `map.add-time-filter`    | Animate a layer over a TIMESTAMP/DATE column.                  |

## Picking a layer type

- Individual locations → `point` (`cluster` for zoom-out density, `heatmap`
  for continuous intensity).
- Pre-aggregated H3 cells → `h3`.
- Origin→destination flows → `arc`.
- Polylines / polygons → `geojson`. A decoded GEOMETRY `geom`
  column (e.g. from an admin boundary) can be rendered directly with `geojson`
  — do NOT convert it to lat/lon columns or build an intermediate table.
- Time-animated movement → `trip`.

## Skill-specific tips

- Numeric types for map data: lat/lon and other coordinates MUST be DOUBLE.
  - When generating inline `VALUES` with decimals (e.g. lat/lon literals), cast
    explicitly: `CAST(32.3617 AS DOUBLE)`.
  - When querying existing tables with DECIMAL columns, cast to DOUBLE:
    `CAST(latitude AS DOUBLE)`.
- `colorBy` is case-sensitive and must match the column name exactly.
- `simpleColor` is the string `"[r, g, b]"` (e.g. `"[255, 64, 0]"`), not an array.
  It is a single static color for ALL features — NEVER use it for data-driven
  coloring; use `colorBy` + `colorType` + `colorMap` for that.
- For `heatmap`, only `colorRange` (from `colorMap`) takes effect.
- If a table lacks the column names the handler auto-detects, rename in SQL
  first (`SELECT lat AS latitude, …`).
- `centerMap` defaults to `true` and zooms the map to fit the new layer.
- Each `map.create-layer` call creates a map artifact with a `mapId`.
  The returned `mapId` is essential — pass it to `map.add-time-filter` so the
  time filter targets the correct map.
- `map.create-layer` returns `layerId`, `mapId`, and for non-trip layers,
  `dateTimeColumns` / `integerTemporalColumns` hints for `map.add-time-filter`.

## Trip layers (`layerType: "trip"`)

- Trip layers have **built-in** time animation. Do NOT add a `map.add-time-filter`
  for a trip layer — it is unnecessary. After creating a trip layer, STOP.
- Strict columns: `id` (VARCHAR, shared across a trip's waypoints), `latitude` /
  `longitude` (DOUBLE), `timestamp` (BIGINT epoch **milliseconds**, 2020+). CAST to
  BIGINT before multiplying epoch seconds by 1000 (INT32 overflows).
- Densify sparse O-D data (interpolate lon/lat AND timestamp) or trips teleport.
- See `references/trip-time-split.md` for full detail.

## Time animation (`map.add-time-filter`, NON-trip layers)

- If `map.create-layer` returned `dateTimeColumns`, call `map.add-time-filter` with
  the first one AND the `mapId` returned by that same `map.create-layer` call.
- **Do not retry `map.add-time-filter` more than once.** If it fails, report the
  error and continue.

## data.classify method picker

| user intent                          | method               | extra params |
| ------------------------------------ | -------------------- | ------------ |
| even-sized buckets                   | `quantile`           | `k`          |
| natural clusters in the distribution | `natural breaks`     | `k`          |
| equally-spaced numeric ranges        | `equal interval`     | `k`          |
| categorical column                   | `unique values`      | —            |

`k` defaults to 5.

## Workflow

1. Pick layer type from data shape.
2. For colored maps: `data.classify` → build `colorMap` → `map.create-layer` with
   `colorBy`, `colorType`, `colorMap`.

## Worked example: data.classify → map.create-layer

Full envelope shown once; remaining examples show only `input`.

```json
{
  "call": {
    "apiName": "executeCommand",
    "args": {
      "commandId": "data.classify",
      "input": {
        "datasetName": "shops",
        "variableName": "visits",
        "method": "natural breaks",
        "k": 5
      }
    }
  },
  "reasoning": "Compute natural-breaks classes for shop visit counts."
}
```

Suppose the response is `result.data: { breaks: [3, 10, 25, 50, 100] }`. Build the layer
with k+1 = 6 colorMap entries:

```json
{
  "call": {
    "apiName": "executeCommand",
    "args": {
      "commandId": "map.create-layer",
      "input": {
        "tableName": "shops",
        "layerType": "point",
        "layerName": "Shops by visits",
        "colorBy": "visits",
        "colorType": "breaks",
        "colorMap": [
          {"value": 3, "color": "#ffffcc"},
          {"value": 10, "color": "#c2e699"},
          {"value": 25, "color": "#78c679"},
          {"value": 50, "color": "#31a354"},
          {"value": 100, "color": "#006837"},
          {"value": null, "color": "#004529"}
        ]
      }
    }
  },
  "reasoning": "Render shops as points colored by visit count."
}
```

## Other examples (input only)

Point layer with a uniform color:

```json
{
  "tableName": "pizza_stores",
  "layerType": "point",
  "layerName": "Pizza stores",
  "simpleColor": "[255, 64, 0]"
}
```

H3 layer:

```json
{
  "tableName": "visits_h3_r9",
  "layerType": "h3",
  "layerName": "Visits density (h3 r9)",
  "colorBy": "visit_count",
  "colorType": "breaks",
  "colorMap": [
    {"value": 100, "color": "#fee5d9"},
    {"value": 500, "color": "#fcae91"},
    {"value": 2000, "color": "#fb6a4a"},
    {"value": 10000, "color": "#de2d26"},
    {"value": null, "color": "#a50f15"}
  ]
}
```

## Suggested palettes

- Sequential green: `#ffffcc #c2e699 #78c679 #31a354 #006837 #004529`
- Sequential red: `#fee5d9 #fcae91 #fb6a4a #de2d26 #a50f15`
- Categorical (Tableau 10): `#1f77b4 #ff7f0e #2ca02c #d62728 #9467bd #8c564b`
