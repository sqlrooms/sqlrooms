"""Core flowmap processing logic."""

import math
from typing import Optional

import duckdb


class FlowmapProcessor:
    """Process origin-destination data into hierarchical clusters for tiling."""

    def __init__(
        self,
        locations_file: str,
        flows_file: str,
        cluster_radius: float = 40.0,
        min_zoom: int = 0,
        max_zoom: int = 20,
        time_bucket: Optional[str] = None,
        time_zone: str = "UTC",
    ):
        """
        Initialize the flowmap processor.

        Args:
            locations_file: Path to locations data (CSV or Parquet)
            flows_file: Path to flows data (CSV or Parquet)
            cluster_radius: Clustering radius in pixels (default: 40)
            min_zoom: Minimum zoom level for clustering
            max_zoom: Maximum zoom level to start from
            time_bucket: Optional temporal aggregation (e.g., 'hour', 'day', 'week', 'month')
            time_zone: Time zone for temporal aggregation (default: 'UTC')
        """
        self.locations_file = locations_file
        self.flows_file = flows_file
        self.cluster_radius_pixels = cluster_radius
        self.min_zoom = min_zoom
        self.max_zoom = max_zoom
        self.time_bucket = time_bucket
        self.time_zone = time_zone
        self.conn = None
        self.extent = None  # Global spatial extent for Hilbert indexing

    def process(self, output_file: str, flows_output_file: Optional[str] = None) -> None:
        """
        Process the flowmap data and generate hierarchical clusters.

        Args:
            output_file: Path to output Parquet file for clusters
            flows_output_file: Optional path to output Parquet file for tiled flows
        """
        self.conn = duckdb.connect(":memory:")

        # Install and load spatial extension
        self.conn.execute("INSTALL spatial")
        self.conn.execute("LOAD spatial")

        # Load input data
        self._load_data()

        # Project locations to Web Mercator and calculate Hilbert index
        self._project_locations()

        # Calculate flow weights
        self._calculate_weights()

        # Perform hierarchical clustering
        self._hierarchical_clustering()

        # Export cluster results
        self._export_results(output_file)

        # Process and export flows if output file specified
        if flows_output_file:
            self._process_flows()
            self._export_flows(flows_output_file)

        self.conn.close()

    def _load_data(self) -> None:
        """Load locations and flows data into DuckDB."""
        # Load locations
        self.conn.execute(
            f"""
            CREATE TABLE locations_raw AS
            SELECT * FROM read_csv_auto('{self.locations_file}', 
                                        all_varchar=false)
            """
            if self.locations_file.endswith(".csv")
            else f"CREATE TABLE locations_raw AS SELECT * FROM '{self.locations_file}'"
        )

        # Load flows
        self.conn.execute(
            f"""
            CREATE TABLE flows_raw AS
            SELECT * FROM read_csv_auto('{self.flows_file}',
                                        all_varchar=false)
            """
            if self.flows_file.endswith(".csv")
            else f"CREATE TABLE flows_raw AS SELECT * FROM '{self.flows_file}'"
        )

    def _project_locations(self) -> None:
        """Project locations to Web Mercator and calculate Hilbert index."""
        # First, calculate extent for Hilbert index
        extent_result = self.conn.execute(
            """
            SELECT 
                MIN(ST_X(ST_Transform(
                    ST_Point(lon, lat),
                    'EPSG:4326', 'EPSG:3857', always_xy := true
                ))) as min_x,
                MAX(ST_X(ST_Transform(
                    ST_Point(lon, lat),
                    'EPSG:4326', 'EPSG:3857', always_xy := true
                ))) as max_x,
                MIN(ST_Y(ST_Transform(
                    ST_Point(lon, lat),
                    'EPSG:4326', 'EPSG:3857', always_xy := true
                ))) as min_y,
                MAX(ST_Y(ST_Transform(
                    ST_Point(lon, lat),
                    'EPSG:4326', 'EPSG:3857', always_xy := true
                ))) as max_y
            FROM locations_raw
            """
        ).fetchone()

        min_x, max_x, min_y, max_y = extent_result
        
        # Store extent as geometry for use in flows processing
        self.conn.execute(
            f"""
            CREATE TABLE spatial_extent AS
            SELECT ST_MakeBox2D(
                ST_Point({min_x}, {min_y}),
                ST_Point({max_x}, {max_y})
            ) as extent
            """
        )

        # Create projected locations table with Hilbert index
        self.conn.execute(
            f"""
            CREATE TABLE locations_projected AS
            SELECT 
                id,
                COALESCE(name, CAST(id AS VARCHAR)) as name,
                lat as lat,
                lon as lon,
                ST_X(ST_Transform(
                    ST_Point(lon, lat),
                    'EPSG:4326', 'EPSG:3857', always_xy := true
                )) as x,
                ST_Y(ST_Transform(
                    ST_Point(lon, lat),
                    'EPSG:4326', 'EPSG:3857', always_xy := true
                )) as y,
                ST_Hilbert(
                    ST_X(ST_Transform(
                        ST_Point(lon, lat),
                        'EPSG:4326', 'EPSG:3857', always_xy := true
                    )),
                    ST_Y(ST_Transform(
                        ST_Point(lon, lat),
                        'EPSG:4326', 'EPSG:3857', always_xy := true
                    )),
                    ST_MakeBox2D(
                        ST_Point({min_x}, {min_y}),
                        ST_Point({max_x}, {max_y})
                    )
                ) as h_index
            FROM locations_raw
            """
        )

    def _calculate_weights(self) -> None:
        """Calculate location weights based on max of in/out flows."""
        self.conn.execute(
            """
            CREATE TABLE location_weights AS
            WITH out_flows AS (
                SELECT 
                    origin as id,
                    SUM(count) as out_weight
                FROM flows_raw
                GROUP BY origin
            ),
            in_flows AS (
                SELECT 
                    dest as id,
                    SUM(count) as in_weight
                FROM flows_raw
                GROUP BY dest
            )
            SELECT 
                l.id,
                l.name,
                l.lat,
                l.lon,
                l.x,
                l.y,
                l.h_index,
                GREATEST(
                    COALESCE(o.out_weight, 0),
                    COALESCE(i.in_weight, 0)
                ) as weight
            FROM locations_projected l
            LEFT JOIN out_flows o ON l.id = o.id
            LEFT JOIN in_flows i ON l.id = i.id
            """
        )

    def _hierarchical_clustering(self) -> None:
        """Perform hierarchical clustering across zoom levels."""
        # Create initial table with all locations at max zoom + 1
        num_locations = self.conn.execute(
            "SELECT COUNT(*) FROM location_weights"
        ).fetchone()[0]
        
        print(f"\nClustering {num_locations} locations from z={self.max_zoom} down to z={self.min_zoom}:")
        
        self.conn.execute(
            f"""
            CREATE TABLE clusters AS
            SELECT 
                {self.max_zoom + 1} as z,
                h_index,
                id,
                name,
                NULL::VARCHAR as parent_id,
                lat,
                lon,
                x,
                y,
                weight,
                1 as size,
                id as top_id
            FROM location_weights
            """
        )

        # Find the highest zoom level that actually has locations
        start_zoom = self.max_zoom

        # Cluster from max_zoom down to min_zoom
        for z in range(self.max_zoom, self.min_zoom - 1, -1):
            self._cluster_at_zoom(z)

        # Remove zoom levels with no actual clustering
        print("\nRemoving duplicate zoom levels...")
        self._remove_duplicate_zoom_levels()
        
        # Show final zoom level distribution
        zoom_dist = self.conn.execute(
            """
            SELECT z, COUNT(*) as count
            FROM clusters
            WHERE parent_id IS NULL
            GROUP BY z
            ORDER BY z DESC
            """
        ).fetchall()
        print(f"\nFinal distribution:")
        for z, count in zoom_dist:
            print(f"  z={z}: {count} clusters")

    def _get_cluster_radius_for_zoom(self, z: int) -> float:
        """
        Calculate cluster radius in meters for a given zoom level.

        At zoom level z, the resolution at the equator is:
        resolution = (2 * π * 6378137) / (256 * 2^z) meters per pixel

        Args:
            z: Zoom level

        Returns:
            Cluster radius in Web Mercator meters
        """
        # Earth's radius in meters (Web Mercator uses WGS84)
        earth_radius = 6378137.0
        # Meters per pixel at this zoom level (at equator)
        resolution = (2 * math.pi * earth_radius) / (256 * (2 ** z))
        # Convert pixel radius to meters
        return self.cluster_radius_pixels * resolution

    def _cluster_at_zoom(self, z: int) -> None:
        """
        Cluster locations at a specific zoom level.

        Args:
            z: Zoom level to cluster at
        """
        # Get locations/clusters from z+1 that haven't been clustered yet
        unclustered = self.conn.execute(
            f"""
            SELECT id, name, x, y, weight, h_index, lat, lon, size, top_id
            FROM clusters
            WHERE z = {z + 1}
            ORDER BY weight DESC
            """
        ).fetchall()

        if not unclustered:
            return

        clustered_ids = set()
        new_cluster_id = 0
        cluster_radius = self._get_cluster_radius_for_zoom(z)
        
        print(f"  z={z}: radius={cluster_radius:.0f}m, {len(unclustered)} locations", end="")

        while len(clustered_ids) < len(unclustered):
            # Find next unclustered location with highest weight
            seed = None
            for loc in unclustered:
                if loc[0] not in clustered_ids:
                    seed = loc
                    break

            if seed is None:
                break

            seed_id, seed_label, seed_x, seed_y, seed_weight, seed_h, seed_lat, seed_lon, seed_size, seed_top_id = seed

            # Find all locations within cluster radius
            cluster_members = []
            for loc in unclustered:
                loc_id, loc_label, loc_x, loc_y, loc_weight, loc_h, loc_lat, loc_lon, loc_size, loc_top_id = loc
                if loc_id not in clustered_ids:
                    dist = math.sqrt((loc_x - seed_x) ** 2 + (loc_y - seed_y) ** 2)
                    if dist <= cluster_radius:
                        cluster_members.append(loc)
                        clustered_ids.add(loc_id)

            if len(cluster_members) == 1:
                # Single location - just copy to this zoom level
                member_id = cluster_members[0][0]
                self.conn.execute(
                    f"""
                    INSERT INTO clusters
                    SELECT 
                        {z} as z,
                        h_index,
                        id,
                        name,
                        NULL as parent_id,
                        lat,
                        lon,
                        x,
                        y,
                        weight,
                        size,
                        top_id
                    FROM clusters
                    WHERE z = {z + 1} AND id = '{member_id}'
                    """
                )
            else:
                # Create cluster
                cluster_id = f"cluster_z{z}_{new_cluster_id}"
                new_cluster_id += 1

                # Calculate center of mass
                total_weight = sum(m[4] for m in cluster_members)
                center_x = sum(m[2] * m[4] for m in cluster_members) / total_weight
                center_y = sum(m[3] * m[4] for m in cluster_members) / total_weight

                # Convert back to lat/lon
                center_lat_lon = self.conn.execute(
                    f"""
                    SELECT 
                        ST_Y(ST_Transform(
                            ST_Point({center_x}, {center_y}),
                            'EPSG:3857', 'EPSG:4326', always_xy := true
                        )) as lat,
                        ST_X(ST_Transform(
                            ST_Point({center_x}, {center_y}),
                            'EPSG:3857', 'EPSG:4326', always_xy := true
                        )) as lon
                    """
                ).fetchone()

                center_lat, center_lon = center_lat_lon

                # Calculate Hilbert index for cluster center
                cluster_h = self.conn.execute(
                    f"""
                    SELECT ST_Hilbert({center_x}, {center_y}, 
                        (SELECT ST_MakeBox2D(
                            ST_Point(MIN(x), MIN(y)),
                            ST_Point(MAX(x), MAX(y))
                        ) FROM location_weights)
                    ) as h_index
                    """
                ).fetchone()[0]

                # Calculate total leaves and find top leaf
                total_leaves = sum(m[8] for m in cluster_members)  # size is index 8
                
                # Find the member with highest weight to determine top_id
                top_member = max(cluster_members, key=lambda m: m[4])  # weight is index 4
                top_id = top_member[9]  # top_id is index 9
                
                # Get the name of the top leaf location
                top_leaf_name = self.conn.execute(
                    f"""
                    SELECT name 
                    FROM location_weights 
                    WHERE id = '{top_id}'
                    """
                ).fetchone()[0]
                
                # Create cluster name
                if total_leaves == 1:
                    cluster_label = top_leaf_name
                else:
                    cluster_label = f"{top_leaf_name} + {total_leaves - 1}"

                # Insert cluster
                self.conn.execute(
                    f"""
                    INSERT INTO clusters (z, h_index, id, name, parent_id, lat, lon, x, y, weight, size, top_id)
                    VALUES (
                        {z},
                        {cluster_h},
                        '{cluster_id}',
                        '{cluster_label.replace("'", "''")}',
                        NULL,
                        {center_lat},
                        {center_lon},
                        {center_x},
                        {center_y},
                        {total_weight},
                        {total_leaves},
                        '{top_id}'
                    )
                    """
                )

                # Update parent_id for cluster members
                member_ids = [m[0] for m in cluster_members]
                member_ids_str = "', '".join(member_ids)
                self.conn.execute(
                    f"""
                    UPDATE clusters
                    SET parent_id = '{cluster_id}'
                    WHERE z = {z + 1} AND id IN ('{member_ids_str}')
                    """
                )
        
        # Count how many actual clusters were created
        num_clusters = self.conn.execute(
            f"SELECT COUNT(*) FROM clusters WHERE z = {z} AND parent_id IS NULL"
        ).fetchone()[0]
        print(f" → {num_clusters} clusters")

    def _remove_duplicate_zoom_levels(self) -> None:
        """Remove zoom levels that have identical clusters to the level above."""
        # Get all zoom levels
        zoom_levels = self.conn.execute(
            "SELECT DISTINCT z FROM clusters ORDER BY z DESC"
        ).fetchall()

        zoom_levels = [z[0] for z in zoom_levels]

        for i in range(len(zoom_levels) - 1):
            z_high = zoom_levels[i]
            z_low = zoom_levels[i + 1]

            # Check if clusters are identical (same number and same positions)
            identical = self.conn.execute(
                f"""
                WITH high_clusters AS (
                    SELECT id, x, y FROM clusters WHERE z = {z_high} AND parent_id IS NULL
                ),
                low_clusters AS (
                    SELECT id, x, y FROM clusters WHERE z = {z_low} AND parent_id IS NULL
                )
                SELECT 
                    (SELECT COUNT(*) FROM high_clusters) = (SELECT COUNT(*) FROM low_clusters)
                    AND NOT EXISTS (
                        SELECT 1 FROM high_clusters
                        EXCEPT
                        SELECT 1 FROM low_clusters
                    ) as is_identical
                """
            ).fetchone()[0]

            if identical:
                # Remove the higher zoom level
                self.conn.execute(f"DELETE FROM clusters WHERE z = {z_high}")

    def _process_flows(self) -> None:
        """Process flows with nested Hilbert indexing for all zoom levels."""
        print("\nProcessing flows with nested Hilbert indexing...")
        
        # Step 1: Compute location Hilbert indices
        print("  Computing location Hilbert indices...")
        self.conn.execute(
            """
            CREATE TABLE location_h AS
            SELECT 
                id, 
                x, 
                y,
                ST_Hilbert(x, y, (SELECT extent FROM spatial_extent)) AS h
            FROM location_weights
            """
        )
        
        # Step 2: Join flows with location Hilbert indices
        print("  Joining flows with location indices...")
        
        # Check if time column exists
        has_time = self.conn.execute(
            """
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_name = 'flows_raw' AND column_name = 'time'
            """
        ).fetchone()[0] > 0
        
        time_select = ""
        time_group = ""
        if has_time and self.time_bucket:
            time_select = f", date_trunc('{self.time_bucket}', time AT TIME ZONE '{self.time_zone}') AS time_bucket"
            time_group = ", time_bucket"
        elif has_time:
            time_select = ", time"
            time_group = ", time"
        
        # Create base flows with Hilbert indices
        self.conn.execute(
            f"""
            CREATE TABLE flows_with_h AS
            SELECT 
                f.origin,
                f.dest,
                f.count,
                o.h AS origin_h,
                d.h AS dest_h
                {time_select}
            FROM flows_raw f
            JOIN location_h o ON f.origin = o.id
            JOIN location_h d ON f.dest = d.id
            WHERE f.origin != f.dest  -- Exclude self-loops
            """
        )
        
        # Step 3: Compute extent over (origin_h, dest_h) for nested Hilbert
        print("  Computing OD extent for nested Hilbert...")
        self.conn.execute(
            """
            CREATE TABLE od_extent AS
            SELECT ST_MakeBox2D(
                ST_Point(MIN(origin_h), MIN(dest_h)),
                ST_Point(MAX(origin_h), MAX(dest_h))
            ) AS extent
            FROM flows_with_h
            """
        )
        
        # Step 4: Compute nested Hilbert index (flow_h)
        print("  Computing nested Hilbert index for flows...")
        self.conn.execute(
            """
            ALTER TABLE flows_with_h ADD COLUMN flow_h BIGINT
            """
        )
        self.conn.execute(
            """
            UPDATE flows_with_h
            SET flow_h = ST_Hilbert(
                CAST(origin_h AS DOUBLE), 
                CAST(dest_h AS DOUBLE), 
                (SELECT extent FROM od_extent)
            )
            """
        )
        
        # Step 5: Create aggregated flows table for all zoom levels
        print("  Aggregating flows across zoom levels...")
        self.conn.execute(
            f"""
            CREATE TABLE tiled_flows AS
            SELECT 
                {self.max_zoom + 1} as z,
                flow_h,
                origin,
                dest,
                count
                {time_select}
            FROM flows_with_h
            """
        )
        
        # Step 6: Get actual zoom levels that exist in clusters (after deduplication)
        existing_zooms = self.conn.execute(
            """
            SELECT DISTINCT z 
            FROM clusters 
            WHERE parent_id IS NULL
            ORDER BY z DESC
            """
        ).fetchall()
        existing_zooms = [z[0] for z in existing_zooms]
        
        print(f"  Aggregating flows for {len(existing_zooms)} zoom levels: {existing_zooms}")
        
        # Step 7: Aggregate flows for each zoom level using cluster hierarchy
        for z in existing_zooms:
            if z == self.max_zoom + 1:
                # Skip - already have base level flows
                continue
            print(f"  Aggregating flows at z={z}...")
            
            # Get cluster assignments for this zoom level
            # Need to map each original location to its cluster at this zoom
            self.conn.execute(
                f"""
                CREATE TEMP TABLE cluster_map_z{z} AS
                WITH RECURSIVE find_cluster AS (
                    -- Base: locations at max_zoom + 1
                    SELECT id, id as cluster_id, {self.max_zoom + 1} as z
                    FROM location_weights
                    
                    UNION ALL
                    
                    -- Recursive: follow parent links up to level z
                    SELECT fc.id, c.parent_id as cluster_id, c.z - 1 as z
                    FROM find_cluster fc
                    JOIN clusters c ON fc.cluster_id = c.id AND c.z = fc.z
                    WHERE c.parent_id IS NOT NULL AND c.z > {z}
                )
                SELECT id, COALESCE(cluster_id, id) as cluster_id
                FROM find_cluster
                WHERE z = {z}
                """
            )
            
            # Aggregate flows using cluster mapping
            self.conn.execute(
                f"""
                CREATE TEMP TABLE flows_z{z} AS
                SELECT
                    COALESCE(co.cluster_id, f.origin) as origin,
                    COALESCE(cd.cluster_id, f.dest) as dest,
                    SUM(f.count) as count
                    {time_group and ', f.time_bucket' or (has_time and ', f.time' or '')}
                FROM flows_with_h f
                LEFT JOIN cluster_map_z{z} co ON f.origin = co.id
                LEFT JOIN cluster_map_z{z} cd ON f.dest = cd.id
                WHERE COALESCE(co.cluster_id, f.origin) != COALESCE(cd.cluster_id, f.dest)
                GROUP BY COALESCE(co.cluster_id, f.origin), COALESCE(cd.cluster_id, f.dest){time_group or (has_time and ', f.time' or '')}
                """
            )
            
            # Compute flow_h for aggregated flows using cluster coordinates
            self.conn.execute(
                f"""
                INSERT INTO tiled_flows
                SELECT
                    {z} as z,
                    ST_Hilbert(
                        CAST(
                            COALESCE(
                                (SELECT ST_Hilbert(x, y, (SELECT extent FROM spatial_extent))
                                 FROM clusters WHERE id = f.origin AND z = {z} LIMIT 1),
                                (SELECT h FROM location_h WHERE id = f.origin)
                            ) AS DOUBLE
                        ),
                        CAST(
                            COALESCE(
                                (SELECT ST_Hilbert(x, y, (SELECT extent FROM spatial_extent))
                                 FROM clusters WHERE id = f.dest AND z = {z} LIMIT 1),
                                (SELECT h FROM location_h WHERE id = f.dest)
                            ) AS DOUBLE
                        ),
                        (SELECT extent FROM od_extent)
                    ) as flow_h,
                    f.origin,
                    f.dest,
                    f.count
                    {time_group and ', f.time_bucket' or (has_time and ', f.time' or '')}
                FROM flows_z{z} f
                """
            )
            
            # Clean up temp tables
            self.conn.execute(f"DROP TABLE flows_z{z}")
            self.conn.execute(f"DROP TABLE cluster_map_z{z}")
        
        print(f"  Total flows: {self.conn.execute('SELECT COUNT(*) FROM tiled_flows').fetchone()[0]:,}")
    
    def _export_flows(self, output_file: str) -> None:
        """
        Export tiled flows to Parquet file.

        Args:
            output_file: Path to output Parquet file for flows
        """
        print(f"\nExporting flows to {output_file}...")
        
        # Determine if we have time column
        has_time = self.conn.execute(
            """
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_name = 'tiled_flows' AND column_name IN ('time', 'time_bucket')
            """
        ).fetchone()[0] > 0
        
        time_col = "time_bucket" if self.time_bucket else "time"
        order_clause = f"z DESC, flow_h, {time_col}" if has_time else "z DESC, flow_h"
        
        self.conn.execute(
            f"""
            COPY (
                SELECT * FROM tiled_flows
                ORDER BY {order_clause}
            ) TO '{output_file}' (FORMAT PARQUET)
            """
        )

    def _export_results(self, output_file: str) -> None:
        """
        Export clustered results to Parquet file.

        Args:
            output_file: Path to output Parquet file
        """
        self.conn.execute(
            f"""
            COPY (
                SELECT z, h_index, id, name, parent_id, lat, lon, x, y, weight, size, top_id
                FROM clusters
                ORDER BY z DESC, h_index
            ) TO '{output_file}' (FORMAT PARQUET)
            """
        )

