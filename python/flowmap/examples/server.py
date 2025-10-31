"""
Flask server for serving flowmap vector tiles from Parquet files.

Usage:
    python server.py --clusters data/clusters.parquet --flows data/flows.parquet
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


def init_database(clusters_file: str, flows_file: str):
    """Initialize DuckDB connection and load data."""
    global con, available_zooms
    
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
    
    # Get available zoom levels (sorted ascending for bisect)
    available_zooms = con.execute("""
        SELECT DISTINCT z FROM clusters ORDER BY z ASC
    """).fetchall()
    available_zooms = [z[0] for z in available_zooms]
    
    print(f"Loaded data with zoom levels: {available_zooms}")
    
    # Create indexes for performance
    con.execute("CREATE INDEX idx_clusters_z ON clusters(z)")
    con.execute("CREATE INDEX idx_flows_z ON flows(z)")


def find_best_zoom(requested_zoom: int) -> int:
    """Find the best matching zoom level from available data."""
    if not available_zooms:
        return requested_zoom
    
    # Find the closest zoom level that is <= requested zoom
    idx = bisect.bisect_right(available_zooms, requested_zoom)
    if idx == 0:
        return available_zooms[0]
    return available_zooms[idx - 1]


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
                    ST_AsMVTGeom(
                        ST_Point(x, y),
                        (SELECT bounds FROM tile_bounds),
                        4096,
                        64
                    ) AS geometry
                FROM clusters, tile_bounds
                WHERE z = $4
                  AND parent_id IS NULL
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
                JOIN clusters co ON f.origin = co.id AND co.z = $4 AND co.parent_id IS NULL
                JOIN clusters cd ON f.dest = cd.id AND cd.z = $4 AND cd.parent_id IS NULL
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
            print(f"Flows tile z={z} x={x} y={y} (data_zoom={data_zoom}): {len(tile)} bytes")
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
            WHERE parent_id IS NULL
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
            WHERE parent_id IS NULL
        """).fetchone()
        
        # Get location count
        location_count = cursor.execute("""
            SELECT COUNT(DISTINCT id) 
            FROM clusters 
            WHERE parent_id IS NULL
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
                        Weight: ${properties.weight.toLocaleString()}<br>
                        Size: ${properties.size} locations
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
    parser.add_argument('--clusters', required=True, help='Path to clusters Parquet file')
    parser.add_argument('--flows', required=True, help='Path to flows Parquet file')
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to')
    parser.add_argument('--port', default=5000, type=int, help='Port to bind to')
    
    args = parser.parse_args()
    
    # Initialize database
    init_database(args.clusters, args.flows)
    
    # Start server
    print(f"Starting server at http://{args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=True)

