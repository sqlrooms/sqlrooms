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
  --radius 40 \
  --min-zoom 0 \
  --max-zoom 20
```

### Parameters

- `--locations` - Path to locations CSV/Parquet file
- `--flows` - Path to flows CSV/Parquet file
- `--output` - Path to output Parquet file
- `--radius` - Cluster radius in pixels (default: 40). This scales with zoom level - at lower zoom levels (zoomed out), more locations will cluster together
- `--min-zoom` - Minimum zoom level for clustering (default: 0)
- `--max-zoom` - Maximum zoom level to start from (default: 20)

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
- `name` - cluster/location name (format: "Location + N" where N is the count of other locations in the cluster)
- `parent_id` - parent cluster ID (NULL for top-level)
- `lat` - WGS84 latitude
- `lon` - WGS84 longitude
- `x` - Web Mercator X coordinate
- `y` - Web Mercator Y coordinate
- `weight` - cluster weight (max of in/out flows)
- `num_leaves` - total number of original locations in this cluster
- `top_leaf_id` - ID of the highest-weighted original location in this cluster

## License

MIT
