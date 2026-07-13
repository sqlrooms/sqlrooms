# Trip layers, time animation — detailed recipes

Read this before building a `trip` layer or adding a time filter. The SKILL.md
keeps the must-not-forget guardrails; the full column requirements,
densification rules, and worked JSON envelopes live here.

## Trip layers (`layerType: "trip"`)

Trip layers have **built-in** time animation driven by their timestamp column.
Do NOT add a time filter (`map.add-time-filter`) for a trip layer — it is
unnecessary and can break the animation. After creating a trip layer, STOP.

Column requirements (STRICT):

- `id`: named exactly `id` (VARCHAR). The same trip/entity shares the same `id`
  across all of its waypoints (`CAST(taxi_id AS VARCHAR) AS id`).
- `latitude` / `longitude`: DOUBLE.
- `timestamp`: BIGINT epoch **milliseconds** (e.g. `1704067200000`), realistic
  modern dates (2020+). To convert epoch seconds, CAST to BIGINT **before**
  multiplying (`CAST(ts AS BIGINT) * 1000`) — multiplying an INT32 by 1000
  overflows ("Out of Range Error: Overflow in multiplication of INT32"). Build the
  epoch-ms value in a SINGLE expression and never post-scale it again.

Densification (MANDATORY for sparse data): a trip moves in STRAIGHT lines between
consecutive points, so sparse O-D data teleports. Linearly interpolate
intermediate points (longitude, latitude AND timestamp) before creating the
layer — ~50 sub-points for O-D straight lines, ~20 for multi-waypoint routes.

### Example — trip layer (full envelope)

```json
{
  "call": {
    "apiName": "executeCommand",
    "args": {
      "commandId": "map.create-layer",
      "input": {
        "tableName": "flights_trips",
        "layerType": "trip",
        "layerName": "Flights animation",
        "trailLength": 3600,
        "fadeTrail": true
      }
    }
  },
  "reasoning": "Animate densified flight paths."
}
```

## Time animation (`map.add-time-filter`)

For NON-trip layers whose data has a separate temporal column.

- After `map.create-layer`, if the result has `dateTimeColumns`, call
  `map.add-time-filter` with the first one AND the `mapId` returned by that
  same `map.create-layer` call.
- **Do not retry `map.add-time-filter` more than once.** If it fails, report
  the error and continue.

### Example — animate a temporal point layer

```json
{
  "call": {
    "apiName": "executeCommand",
    "args": {
      "commandId": "map.add-time-filter",
      "input": {
        "tableName": "earthquakes",
        "dateTimeColumn": "time",
        "interval": "1-month",
        "mapId": "<mapId returned by map.create-layer>"
      }
    }
  },
  "reasoning": "Animate earthquakes month-by-month."
}
```
