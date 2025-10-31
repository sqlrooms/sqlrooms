# sqlrooms-flowmap

Prepare origin-destination datasets for tiling using DuckDB and spatial extensions.

## Installation

```bash
pip install sqlrooms-flowmap
```

## Usage

### Basic Usage

```bash
sqlrooms-flowmap \
  --locations locations.csv \
  --flows flows.csv \
  --output-dir ./output
```

This generates:

- `./output/locations-clusters.parquet` - hierarchical clusters
- `./output/locations-flows.parquet` - tiled flows with nested Hilbert indexing

### Clusters Only (Skip Flows)

```bash
sqlrooms-flowmap \
  --locations locations.csv \
  --flows flows.csv \
  --output-dir ./output \
  --skip-flows
```

### With Custom Parameters

```bash
sqlrooms-flowmap \
  --locations locations.csv \
  --flows flows.csv \
  --output-dir ./output \
  --radius 50 \
  --min-zoom 0 \
  --max-zoom 15
```

### With Temporal Aggregation

```bash
sqlrooms-flowmap \
  --locations locations.csv \
  --flows flows.csv \
  --output-dir ./output \
  --time-bucket day \
  --time-zone America/New_York
```

### Parameters

- `--locations` - Path to locations CSV/Parquet file
- `--flows` - Path to flows CSV/Parquet file
- `--output-dir` - Output directory (files named from locations file)
- `--radius` - Cluster radius in pixels (default: 40). Scales with zoom level
- `--min-zoom` - Minimum zoom level for clustering (default: 0)
- `--max-zoom` - Maximum zoom level to start from (default: 20)
- `--time-bucket` - (Optional) Temporal aggregation: hour, day, week, month, year
- `--time-zone` - Time zone for temporal aggregation (default: UTC)
- `--skip-flows` - Skip flow tiling, only generate clusters

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

#### Clusters Output

Parquet file with hierarchical clusters ordered by zoom level and Hilbert index:

- `z` - zoom level
- `h_index` - Hilbert index for spatial ordering
- `id` - cluster/location ID
- `name` - cluster/location name (format: "Location + N")
- `parent_id` - parent cluster ID (NULL for top-level)
- `lat` - WGS84 latitude
- `lon` - WGS84 longitude
- `x` - Web Mercator X coordinate
- `y` - Web Mercator Y coordinate
- `weight` - cluster weight (max of in/out flows)
- `size` - total number of original locations in this cluster
- `top_id` - ID of the highest-weighted original location in this cluster

#### Flows Output (Optional)

Parquet file with tiled OD flows ordered by `z, flow_h, [time]`:

- `z` - zoom level
- `flow_h` - nested Hilbert index for origin-destination pairs (enables efficient spatial queries)
- `origin` - origin cluster/location ID
- `dest` - destination cluster/location ID
- `count` - aggregated flow count
- `time` or `time_bucket` - temporal dimension (if present in input and/or bucketed)

The flows are spatially indexed using a **nested Hilbert transform** that preserves locality in OD-space, making range queries efficient for tile-based serving.

## License

MIT
