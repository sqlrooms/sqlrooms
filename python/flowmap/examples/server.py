"""
Flask server for serving flowmap vector tiles from Parquet files.

Usage:
    uv run server.py locations --output-dir /path/to/data
"""

import argparse
import bisect
from pathlib import Path

import duckdb
import flask

# Initialize Flask app
app = flask.Flask(__name__)

# Global DuckDB connection
con = None
available_zooms = []


def init_database(dataset_name: str, output_dir: str = "../output"):
    """Initialize DuckDB connection and load data."""
    global con, available_zooms
    
    # Construct file paths
    clusters_file = f"{output_dir}/{dataset_name}-clusters.parquet"
    flows_file = f"{output_dir}/{dataset_name}-flows.parquet"
    metadata_file = f"{output_dir}/{dataset_name}-flows-metadata.parquet"
    
    print(f"Loading dataset '{dataset_name}' from {output_dir}/")
    print(f"  Clusters: {clusters_file}")
    print(f"  Flows: {flows_file}")
    print(f"  Metadata: {metadata_file}")
    
    # Create DuckDB connection with spatial extension
    con = duckdb.connect(":memory:")
    con.execute("INSTALL spatial")
    con.execute("LOAD spatial")
    
    # Load clusters
    con.execute(f"""
        CREATE TABLE clusters AS 
        SELECT * FROM read_parquet('{clusters_file}')
    """)
    
    # Load flows
    con.execute(f"""
        CREATE TABLE flows AS 
        SELECT * FROM read_parquet('{flows_file}')
    """)
    
    # Load metadata for Hilbert range computation
    try:
        con.execute(f"""
            CREATE TABLE flow_metadata AS 
            SELECT * FROM read_parquet('{metadata_file}')
        """)
        print("Loaded flow metadata for Hilbert range filtering")
    except Exception as e:
        print(f"Warning: Could not load metadata file {metadata_file}: {e}")
        print("Hilbert range filtering will not be available")
    
    # Get available zoom levels (sorted ascending for bisect)
    available_zooms = con.execute("""
        SELECT DISTINCT z FROM clusters ORDER BY z ASC
    """).fetchall()
    available_zooms = [z[0] for z in available_zooms]
    
    print(f"Loaded data with zoom levels: {available_zooms}")
    
    # Create indexes for performance
    con.execute("CREATE INDEX idx_clusters_z_id ON clusters(z, id)")
    con.execute("CREATE INDEX idx_clusters_z_parent ON clusters(z, parent_id)")
    con.execute("CREATE INDEX idx_flows_z_h ON flows(z, flow_h)")
    
    # The indexes will help, especially idx_flows_z_h which leverages the
    # sorting. The main benefit of flow_h is: Parquet file ordering - Spatially
    # close flows are stored together, making sequential reads efficient Index
    # scans - The (z, flow_h) index enables efficient range queries For tile
    # queries, we still need to join with clusters to get coordinates for
    # rendering, so the spatial filtering is necessary. The flow_h helps more
    # when reading from disk - DuckDB can scan contiguous blocks of flows
    # efficiently. For even better performance with flow_h, we could compute
    # Hilbert ranges for tiles, but that's complex. The current approach with
    # improved indexes should work well. The sorted Parquet + index means DuckDB
    # can efficiently skip irrelevant flow ranges.


    # Also create a spatial index on cluster coordinates if possible
    # try:
    #     con.execute("CREATE INDEX idx_clusters_coords ON clusters USING RTREE(x, y)")
    # RTree indexes can only be created over a single column.
    # except Exception as e:
    #     print(f"Error: {e}")
    #     print("Note: R-tree spatial index not available, using regular indexes")


def find_best_zoom(requested_zoom: int) -> int:
    """Find the best matching zoom level from available data."""
    if not available_zooms:
        return requested_zoom
    
    # Find the closest zoom level that is <= requested zoom
    idx = bisect.bisect_right(available_zooms, requested_zoom)
    if idx == 0:
        return available_zooms[0]
    return available_zooms[idx - 1]


def compute_hilbert_range_for_tile(z: int, x: int, y: int) -> tuple:
    """
    Compute Hilbert index range for flows within a tile.
    
    Returns (min_h, max_h) covering flows that might be visible in the tile.
    Uses a bounding box approach - may over-select but guarantees coverage.
    """
    with con.cursor() as cursor:
        # Compute everything in one query to avoid passing geometries through Python
        result = cursor.execute("""
            WITH tile_info AS (
                SELECT 
                    CAST(location_extent AS BOX_2D) as loc_ext,
                    CAST(od_extent AS BOX_2D) as od_ext,
                    ST_TileEnvelope($1, $2, $3) as tile_env
                FROM flow_metadata
            ),
            tile_corners AS (
                SELECT
                    loc_ext,
                    od_ext,
                    ST_Hilbert(ST_XMin(tile_env), ST_YMin(tile_env), loc_ext) as h1,
                    ST_Hilbert(ST_XMin(tile_env), ST_YMax(tile_env), loc_ext) as h2,
                    ST_Hilbert(ST_XMax(tile_env), ST_YMin(tile_env), loc_ext) as h3,
                    ST_Hilbert(ST_XMax(tile_env), ST_YMax(tile_env), loc_ext) as h4
                FROM tile_info
            ),
            loc_range AS (
                SELECT
                    od_ext,
                    LEAST(h1, h2, h3, h4) as min_loc_h,
                    GREATEST(h1, h2, h3, h4) as max_loc_h
                FROM tile_corners
            )
            SELECT
                LEAST(
                    ST_Hilbert(min_loc_h, ST_YMin(od_ext), od_ext),
                    ST_Hilbert(min_loc_h, ST_YMax(od_ext), od_ext),
                    ST_Hilbert(max_loc_h, ST_YMin(od_ext), od_ext),
                    ST_Hilbert(max_loc_h, ST_YMax(od_ext), od_ext),
                    ST_Hilbert(ST_XMin(od_ext), min_loc_h, od_ext),
                    ST_Hilbert(ST_XMax(od_ext), min_loc_h, od_ext),
                    ST_Hilbert(ST_XMin(od_ext), max_loc_h, od_ext),
                    ST_Hilbert(ST_XMax(od_ext), max_loc_h, od_ext)
                ) as min_flow_h,
                GREATEST(
                    ST_Hilbert(min_loc_h, ST_YMin(od_ext), od_ext),
                    ST_Hilbert(min_loc_h, ST_YMax(od_ext), od_ext),
                    ST_Hilbert(max_loc_h, ST_YMin(od_ext), od_ext),
                    ST_Hilbert(max_loc_h, ST_YMax(od_ext), od_ext),
                    ST_Hilbert(ST_XMin(od_ext), min_loc_h, od_ext),
                    ST_Hilbert(ST_XMax(od_ext), min_loc_h, od_ext),
                    ST_Hilbert(ST_XMin(od_ext), max_loc_h, od_ext),
                    ST_Hilbert(ST_XMax(od_ext), max_loc_h, od_ext)
                ) as max_flow_h
            FROM loc_range
        """, [z, x, y]).fetchone()
        
        if not result:
            return (None, None)
        
        min_flow_h, max_flow_h = result
        return (min_flow_h, max_flow_h)


@app.route('/clusters/<int:z>/<int:x>/<int:y>.pbf')
def get_clusters_tile(z, x, y):
    """Serve location clusters as vector tiles."""
    # Find best matching zoom level
    data_zoom = find_best_zoom(z)
    
    with con.cursor() as cursor:
        tile_blob = cursor.execute("""
            WITH tile_bounds AS (
                SELECT 
                    ST_TileEnvelope($1, $2, $3) AS envelope,
                    ST_Extent(ST_TileEnvelope($1, $2, $3)) AS bounds
            )
            SELECT ST_AsMVT(tile_data, 'default')
            FROM (
                SELECT 
                    id,
                    name,
                    weight,
                    size,
                    total_in,
                    total_out,
                    total_self,
                    ST_AsMVTGeom(
                        ST_Point(x, y),
                        (SELECT bounds FROM tile_bounds),
                        4096,
                        64
                    ) AS geometry
                FROM clusters, tile_bounds
                WHERE z = $4
                  AND parent_id = id  -- Self-reference = top-level
                  AND ST_Within(ST_Point(x, y), envelope)
            ) AS tile_data
            WHERE geometry IS NOT NULL
        """, [z, x, y, data_zoom]).fetchone()
        
        tile = tile_blob[0] if tile_blob and tile_blob[0] else b''
        
        # Debug logging
        if tile:
            print(f"Clusters tile z={z} x={x} y={y} (data_zoom={data_zoom}): {len(tile)} bytes")
        else:
            print(f"Clusters tile z={z} x={x} y={y} (data_zoom={data_zoom}): empty")
        
        return flask.Response(tile, mimetype='application/x-protobuf')


@app.route('/flows/<int:z>/<int:x>/<int:y>.pbf')
def get_flows_tile(z, x, y):
    """Serve flows as vector tiles."""
    # Find best matching zoom level
    data_zoom = find_best_zoom(z)
    
    # Compute Hilbert range for this tile
    min_h, max_h = compute_hilbert_range_for_tile(z, x, y)
    
    with con.cursor() as cursor:
        # Use Hilbert range if available for fast pre-filtering
        if min_h is not None and max_h is not None:
            tile_blob = cursor.execute("""
                WITH tile_bounds AS (
                    SELECT 
                        ST_TileEnvelope($1, $2, $3) AS envelope,
                        ST_Extent(ST_TileEnvelope($1, $2, $3)) AS bounds
                )
                SELECT ST_AsMVT(tile_data, 'default')
                FROM (
                    SELECT 
                        f.origin,
                        f.dest,
                        f.count,
                        ST_AsMVTGeom(
                            ST_MakeLine(
                                ST_Point(co.x, co.y),
                                ST_Point(cd.x, cd.y)
                            ),
                            (SELECT bounds FROM tile_bounds),
                            4096,
                            64
                        ) AS geometry
                    FROM flows f, tile_bounds
                    JOIN clusters co ON f.origin = co.id AND co.z = $4 AND co.parent_id = co.id
                    JOIN clusters cd ON f.dest = cd.id AND cd.z = $4 AND cd.parent_id = cd.id
                    WHERE f.z = $4
                      AND f.flow_h BETWEEN $5 AND $6  -- Hilbert range filter (fast!)
                      AND (
                          ST_Within(ST_Point(co.x, co.y), envelope)
                          OR ST_Within(ST_Point(cd.x, cd.y), envelope)
                      )
                ) AS tile_data
                WHERE geometry IS NOT NULL
            """, [z, x, y, data_zoom, min_h, max_h]).fetchone()
        else:
            # Fallback without Hilbert filtering
            tile_blob = cursor.execute("""
                WITH tile_bounds AS (
                    SELECT 
                        ST_TileEnvelope($1, $2, $3) AS envelope,
                        ST_Extent(ST_TileEnvelope($1, $2, $3)) AS bounds
                )
                SELECT ST_AsMVT(tile_data, 'default')
                FROM (
                    SELECT 
                        f.origin,
                        f.dest,
                        f.count,
                        ST_AsMVTGeom(
                            ST_MakeLine(
                                ST_Point(co.x, co.y),
                                ST_Point(cd.x, cd.y)
                            ),
                            (SELECT bounds FROM tile_bounds),
                            4096,
                            64
                        ) AS geometry
                    FROM flows f, tile_bounds
                    JOIN clusters co ON f.origin = co.id AND co.z = $4 AND co.parent_id = co.id
                    JOIN clusters cd ON f.dest = cd.id AND cd.z = $4 AND cd.parent_id = cd.id
                    WHERE f.z = $4
                      AND (
                          ST_Within(ST_Point(co.x, co.y), envelope)
                          OR ST_Within(ST_Point(cd.x, cd.y), envelope)
                      )
                ) AS tile_data
                WHERE geometry IS NOT NULL
            """, [z, x, y, data_zoom]).fetchone()
        
        tile = tile_blob[0] if tile_blob and tile_blob[0] else b''
        
        # Debug logging
        if tile:
            range_info = f" (Hilbert: {min_h}-{max_h})" if min_h is not None else ""
            print(f"Flows tile z={z} x={x} y={y} (data_zoom={data_zoom}){range_info}: {len(tile)} bytes")
        else:
            print(f"Flows tile z={z} x={x} y={y} (data_zoom={data_zoom}): empty")
        
        return flask.Response(tile, mimetype='application/x-protobuf')


@app.route('/debug/clusters')
def debug_clusters():
    """Debug endpoint to check cluster data."""
    with con.cursor() as cursor:
        sample = cursor.execute("""
            SELECT z, COUNT(*) as count, MIN(x) as min_x, MAX(x) as max_x, MIN(y) as min_y, MAX(y) as max_y
            FROM clusters
            WHERE parent_id = id  -- Self-reference = top-level
            GROUP BY z
            ORDER BY z DESC
        """).fetchall()
        
        return flask.jsonify({
            'zoom_levels': [{'z': row[0], 'count': row[1], 'min_x': row[2], 'max_x': row[3], 'min_y': row[4], 'max_y': row[5]} for row in sample]
        })


@app.route('/metadata')
def get_metadata():
    """Return metadata about available data."""
    with con.cursor() as cursor:
        # Get bounds
        bounds = cursor.execute("""
            SELECT 
                MIN(lon) as min_lon,
                MIN(lat) as min_lat,
                MAX(lon) as max_lon,
                MAX(lat) as max_lat
            FROM clusters
            WHERE parent_id = id  -- Self-reference = top-level
        """).fetchone()
        
        # Get location count
        location_count = cursor.execute("""
            SELECT COUNT(DISTINCT id) 
            FROM clusters 
            WHERE parent_id = id  -- Self-reference = top-level
        """).fetchone()[0]
        
        # Get flow count
        flow_count = cursor.execute("""
            SELECT COUNT(*) FROM flows
        """).fetchone()[0]
        
        return flask.jsonify({
            'bounds': {
                'min_lon': bounds[0],
                'min_lat': bounds[1],
                'max_lon': bounds[2],
                'max_lat': bounds[3]
            },
            'center': {
                'lon': (bounds[0] + bounds[2]) / 2,
                'lat': (bounds[1] + bounds[3]) / 2
            },
            'zoom_levels': available_zooms,
            'location_count': location_count,
            'flow_count': flow_count
        })


# HTML content for the index page
INDEX_HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Flowmap Viewer</title>
    <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no">
    <script src='https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'></script>
    <link href='https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css' rel='stylesheet' />
    <style>
        body { margin: 0; padding: 0; }
        #map { position: absolute; top: 0; bottom: 0; width: 100%; }
        #info {
            position: absolute;
            top: 10px;
            left: 10px;
            background: white;
            padding: 10px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            font-family: Arial, sans-serif;
            font-size: 12px;
            max-width: 200px;
        }
    </style>
</head>
<body>
<div id="map"></div>
<div id="info">Loading...</div>
<script>
    // Fetch metadata first
    fetch('/metadata')
        .then(res => res.json())
        .then(metadata => {
            document.getElementById('info').innerHTML = `
                <strong>Flowmap Data</strong><br>
                Locations: ${metadata.location_count.toLocaleString()}<br>
                Flows: ${metadata.flow_count.toLocaleString()}<br>
                Zoom levels: ${metadata.zoom_levels.length}
            `;
            
            const map = new maplibregl.Map({
                container: 'map',
                style: {
                    version: 8,
                    sources: {
                        'clusters': {
                            type: 'vector',
                            tiles: [`${window.location.origin}/clusters/{z}/{x}/{y}.pbf`],
                            minzoom: 0,
                            maxzoom: 20
                        },
                        'flows': {
                            type: 'vector',
                            tiles: [`${window.location.origin}/flows/{z}/{x}/{y}.pbf`],
                            minzoom: 0,
                            maxzoom: 20
                        },
                        'osm': {
                            type: 'raster',
                            tiles: [
                                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
                            ],
                            tileSize: 256,
                            attribution: '© OpenStreetMap contributors'
                        }
                    },
                    layers: [
                        {
                            id: 'background',
                            type: 'background',
                            paint: { 'background-color': '#f0f0f0' }
                        },
                        {
                            id: 'osm',
                            type: 'raster',
                            source: 'osm',
                            paint: { 'raster-opacity': 0.5 }
                        },
                        {
                            id: 'flows',
                            type: 'line',
                            source: 'flows',
                            'source-layer': 'default',
                            paint: {
                                'line-color': [
                                    'interpolate',
                                    ['linear'],
                                    ['get', 'count'],
                                    0, '#fee5d9',
                                    100, '#fc8d59',
                                    1000, '#d7301f'
                                ],
                                'line-width': [
                                    'interpolate',
                                    ['linear'],
                                    ['get', 'count'],
                                    0, 1,
                                    100, 2,
                                    1000, 4
                                ],
                                'line-opacity': 0.6
                            }
                        },
                        {
                            id: 'clusters',
                            type: 'circle',
                            source: 'clusters',
                            'source-layer': 'default',
                            paint: {
                                'circle-color': '#2c7fb8',
                                'circle-radius': [
                                    'interpolate',
                                    ['linear'],
                                    ['get', 'weight'],
                                    0, 3,
                                    100, 6,
                                    1000, 10,
                                    10000, 15
                                ],
                                'circle-stroke-color': '#fff',
                                'circle-stroke-width': 1,
                                'circle-opacity': 0.8
                            }
                        }
                    ]
                },
                center: [metadata.center.lon, metadata.center.lat],
                zoom: 6
            });
            
            map.addControl(new maplibregl.NavigationControl());
            
            // Add click handler for clusters
            map.on('click', 'clusters', (e) => {
                const properties = e.features[0].properties;
                new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(`
                        <strong>${properties.name}</strong><br>
                        Size: ${properties.size} locations<br>
                        Weight: ${properties.weight.toLocaleString()}<br>
                        <br>
                        Flows in: ${(properties.total_in || 0).toLocaleString()}<br>
                        Flows out: ${(properties.total_out || 0).toLocaleString()}<br>
                        Internal: ${(properties.total_self || 0).toLocaleString()}
                    `)
                    .addTo(map);
            });
            
            // Add click handler for flows
            map.on('click', 'flows', (e) => {
                const properties = e.features[0].properties;
                new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(`
                        <strong>Flow</strong><br>
                        ${properties.origin} → ${properties.dest}<br>
                        Count: ${properties.count.toLocaleString()}
                    `)
                    .addTo(map);
            });
            
            // Change cursor on hover
            map.on('mouseenter', 'clusters', () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', 'clusters', () => {
                map.getCanvas().style.cursor = '';
            });
            map.on('mouseenter', 'flows', () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', 'flows', () => {
                map.getCanvas().style.cursor = '';
            });
            
            // Update info panel with current zoom
            map.on('zoom', () => {
                const zoom = Math.round(map.getZoom() * 10) / 10;
                document.getElementById('info').innerHTML = `
                    <strong>Flowmap Data</strong><br>
                    Locations: ${metadata.location_count.toLocaleString()}<br>
                    Flows: ${metadata.flow_count.toLocaleString()}<br>
                    Zoom levels: ${metadata.zoom_levels.length}<br>
                    <br>
                    Current zoom: ${zoom}
                `;
            });
        });
</script>
</body>
</html>
"""


@app.route("/")
def index():
    """Serve the index page."""
    return flask.Response(INDEX_HTML, mimetype='text/html')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Serve flowmap data as vector tiles')
    parser.add_argument('dataset', help='Dataset name (e.g., "locations" for output/locations-*.parquet)')
    parser.add_argument('--output-dir', default='output', help='Output directory containing Parquet files (default: output)')
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to')
    parser.add_argument('--port', default=5000, type=int, help='Port to bind to')
    
    args = parser.parse_args()
    
    # Initialize database
    init_database(args.dataset, args.output_dir)
    
    # Start server
    print(f"Starting server at http://{args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=True)

