# Flowmap Viewer Example

A Flask server that serves flowmap data as vector tiles for visualization with MapLibre GL JS.

## Features

- **Dynamic zoom level matching** - Automatically selects the best available zoom level from your data
- **Styled by data** - Point sizes vary by weight, line widths vary by flow count
- **Interactive** - Click on locations and flows to see details
- **Efficient** - Uses DuckDB spatial indexing and MVT generation

## Installation

```bash
# Install package
pip install sqlrooms-flowmap

# Install dev dependencies (includes Flask for the server)
uv sync --group dev

# Or install Flask separately
pip install flask
```

## Usage

First, generate your flowmap data:

```bash
cd ../..
uv run sqlrooms-flowmap \
  --locations data/locations.csv \
  --flows data/flows.csv \
  --output-dir examples/data
```

Then start the server:

```bash
cd examples
python server.py locations --output-dir data
```

Or if using the default `output/` directory:

```bash
python server.py locations
```

Open your browser to http://localhost:5000

## How It Works

### Zoom Level Matching

The server finds the best matching zoom level for each tile request:

```python
def find_best_zoom(requested_zoom: int) -> int:
    """Find the closest zoom level that is <= requested zoom."""
    idx = bisect.bisect_right(available_zooms, requested_zoom)
    if idx == 0:
        return available_zooms[0]
    return available_zooms[idx - 1]
```

### Hilbert Range Filtering (Performance Optimization)

For datasets with millions of flows, the server uses **Hilbert range filtering** to dramatically reduce query time:

1. **Metadata Export**: The processor exports spatial extents used for Hilbert indexing
2. **Range Computation**: For each tile request, compute the Hilbert index range covering flows in that tile
3. **Fast Pre-filtering**: Query uses `WHERE flow_h BETWEEN min AND max` before joining with clusters
4. **Index Utilization**: The `(z, flow_h)` index enables efficient range scans

**Performance**: 
- Scans only 1 column (`flow_h`) instead of 4 (coordinates)
- Leverages sorted Parquet file structure
- Joins only the filtered subset (typically 0.1-1% of total flows per tile)
- **10-100x faster** than spatial-only filtering for large datasets

### Vector Tile Generation

Uses DuckDB's `ST_AsMVT` and `ST_AsMVTGeom` functions to generate Mapbox Vector Tiles:

- **Clusters**: Points with `id`, `name`, `weight`, `size` properties
- **Flows**: Lines with `origin`, `dest`, `count` properties

### Styling

MapLibre GL JS styles vary based on data properties:

**Points (clusters)**:
- Circle radius: 3-15px based on weight
- Color: Blue with white stroke

**Lines (flows)**:
- Width: 1-4px based on count
- Color: Heat map from light orange to dark red based on count
- Opacity: 0.6 for better layering

## Customization

You can customize the styling in the HTML by modifying the MapLibre GL style layers:

```javascript
{
    id: 'clusters',
    type: 'circle',
    source: 'clusters',
    'source-layer': 'default',
    paint: {
        'circle-radius': [
            'interpolate', ['linear'], ['get', 'weight'],
            0, 3,      // weight 0 → 3px
            1000, 10,  // weight 1000 → 10px
            10000, 15  // weight 10000 → 15px
        ]
    }
}
```

