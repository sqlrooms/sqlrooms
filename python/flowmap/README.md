# sqlrooms-flowmap

Prepare origin-destination datasets for tiling using DuckDB and spatial extensions.

## Installation

```bash
pip install sqlrooms-flowmap
```

## Usage

```bash
sqlrooms-flowmap \
  --locations locations.csv \
  --flows flows.parquet \
  --output clusters.parquet \
  --radius 100 \
  --min-zoom 0 \
  --max-zoom 20
```

### Input Data

**Locations table:**

- `id` - unique identifier
- `name` (optional) - location name
- `lat` - WGS84 latitude
- `lon` - WGS84 longitude

**Flows table:**

- `origin` - origin location ID
- `dest` - destination location ID
- `count` - flow magnitude
- `time` (optional) - temporal dimension

### Output

A Parquet file containing hierarchical clusters ordered by zoom level and Hilbert index:

- `z` - zoom level
- `h_index` - Hilbert index for spatial ordering
- `id` - cluster/location ID
- `name` - cluster/location name
- `parent_id` - parent cluster ID (NULL for top-level)
- `lat` - WGS84 latitude
- `lon` - WGS84 longitude
- `x` - Web Mercator X coordinate
- `y` - Web Mercator Y coordinate
- `weight` - cluster weight (max of in/out flows)

## License

MIT
