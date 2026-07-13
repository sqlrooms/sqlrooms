# Administrative Boundaries

Fetch boundary geometries (city, county, state, country, continent, US zipcode,
DMA) from Overture Maps and other sources, saving results to DuckDB tables.

## When to Use

When the user asks for the boundary, outline, or geometry of a place — e.g.
"boundary of San Francisco", "all DMAs in Texas", "zipcodes in Cook County",
"state outlines".

## Prerequisites

The DuckDB instance must have the `spatial` and `httpfs` extensions loaded.
Run this setup before any boundary query:

```sql
INSTALL spatial; LOAD spatial;
INSTALL httpfs; LOAD httpfs;
SET s3_region='us-west-2';
```

## Overture release version

Use the placeholder `{{overtureVersion}}` in S3 paths. It resolves to the
latest Overture Maps release at runtime (e.g. `2026-05-20.0`).

## Workflow

1. Run the setup SQL (extensions + S3 region).
2. Generate the boundary SQL based on the level requested.
3. Execute via `executeApi` → `executeCommand` → `data.query` with
   `saveToTable` to persist the result.

Example envelope:

```json
{
  "call": {
    "apiName": "executeCommand",
    "args": {
      "commandId": "data.query",
      "input": {
        "sqlQuery": "SELECT id, names.primary AS name, region, subtype, geometry AS geom FROM read_parquet('s3://overturemaps-us-west-2/release/{{overtureVersion}}/theme=divisions/type=division_area/*', filename=true, hive_partitioning=1) WHERE names.primary IN ('San Francisco') AND region IN ('US-CA') AND class = 'land' AND is_land = TRUE",
        "saveToTable": "san_francisco_boundary"
      }
    }
  },
  "reasoning": "Fetch San Francisco city boundary from Overture Maps."
}
```

After saving, visualize with `map-visualization` skill using `layerType: "geojson"`.

## Common Setup

**Overture source** (used by city/county/state/country):

```
s3://overturemaps-us-west-2/release/{{overtureVersion}}/theme=divisions/type=division_area/*
```

Read with: `read_parquet('<source>', filename=true, hive_partitioning=1)`

## Overture Boundaries (city/county/state/country)

All use the same source. SELECT columns: `id, names.primary as name, region, subtype, geometry AS geom`.

| Level       | WHERE filters                                                                              | Example                                                      |
| ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| **City**    | `names.primary IN (...)` + `region IN ('US-CA','US-TX')` + `class='land' AND is_land=TRUE` | `names.primary IN ('San Francisco')` + `region IN ('US-CA')` |
| **County**  | `names.primary IN (...)` + `country='US'` + `subtype='county' AND class='land'`            | `names.primary IN ('Cook County')`                           |
| **State**   | `names.primary IN (...)` + `country IN ('US')` + `subtype='region' AND class='land'`       | `names.primary IN ('California')`                            |
| **Country** | `names.primary IN (...)` + `subtype='country' AND class='land'`                            | `names.primary IN ('United States')`                         |

### City Special Cases

1. For New York City, add condition `AND subtype = 'locality'` to differentiate
   the city boundary from the state boundary.
2. For London in UK, only use 33 official administrative divisions of Greater
   London in names.primary, and add bbox check: Longitude: -0.51 to 0.33
   Latitude: 51.28 to 51.69

## Non-Overture Boundaries

### Continent

Values: Africa, Antarctica, Asia, Australia, Europe, North America, Oceania, South America

```sql
SELECT continent, geometry AS geom
FROM read_parquet('https://spatial-desktop.foursquare.com/app-data/geo/continents.parquet')
WHERE continent IN ('North America', 'Europe')
```

### US Zipcode

```sql
SELECT zipcode, city, state, "county-code", geometry AS geom
FROM read_parquet('https://spatial-desktop.foursquare.com/app-data/geo/us_zipcodes.parquet')
WHERE zipcode IN ('10001', '90210')
```

### DMA (Designated Market Area)

```sql
SELECT DMA_Code, NAME AS DMA, geometry AS geom
FROM read_parquet('https://spatial-desktop.foursquare.com/app-data/geo/DMA.parquet')
WHERE NAME IN ('New York', 'Los Angeles')
```

For all three: omit WHERE to get all rows.

## Cross-Boundary Spatial Queries

When the user asks for boundaries of one type **within** another (e.g., "all
DMAs in Texas"), use a two-step spatial join:

1. Save the containing boundary first via `data.query` with `saveToTable`.
2. Spatial join the target boundaries against the saved geometry using
   `ST_Intersects`.

Example — DMAs in Texas:

```json
{
  "call": {
    "apiName": "executeCommand",
    "args": {
      "commandId": "data.query",
      "input": {
        "sqlQuery": "SELECT id, names.primary AS name, geometry AS geom FROM read_parquet('s3://overturemaps-us-west-2/release/{{overtureVersion}}/theme=divisions/type=division_area/*', filename=true, hive_partitioning=1) WHERE names.primary IN ('Texas') AND country IN ('US') AND subtype = 'region' AND class = 'land'",
        "saveToTable": "texas_state"
      }
    }
  },
  "reasoning": "Save Texas state boundary for spatial join."
}
```

Then:

```json
{
  "call": {
    "apiName": "executeCommand",
    "args": {
      "commandId": "data.query",
      "input": {
        "sqlQuery": "SELECT d.DMA_Code, d.NAME AS DMA, d.geometry AS geom FROM read_parquet('https://spatial-desktop.foursquare.com/app-data/geo/DMA.parquet') d, texas_state t WHERE ST_Intersects(ST_GeomFromWKB(d.geometry), t.geom)",
        "saveToTable": "texas_dmas"
      }
    }
  },
  "reasoning": "Spatial join DMAs against Texas boundary."
}
```

## Cross-references

- Load `map-visualization` to render the resulting boundary on the map as a
  `geojson` layer after saving it to a table.
