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
python server.py \
  --clusters data/locations-clusters.parquet \
  --flows data/locations-flows.parquet
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

