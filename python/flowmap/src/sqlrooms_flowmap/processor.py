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
    ):
        """
        Initialize the flowmap processor.

        Args:
            locations_file: Path to locations data (CSV or Parquet)
            flows_file: Path to flows data (CSV or Parquet)
            cluster_radius: Clustering radius in pixels (default: 40)
            min_zoom: Minimum zoom level for clustering
            max_zoom: Maximum zoom level to start from
        """
        self.locations_file = locations_file
        self.flows_file = flows_file
        self.cluster_radius_pixels = cluster_radius
        self.min_zoom = min_zoom
        self.max_zoom = max_zoom
        self.conn = None

    def process(self, output_file: str) -> None:
        """
        Process the flowmap data and generate hierarchical clusters.

        Args:
            output_file: Path to output Parquet file
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

        # Export results
        self._export_results(output_file)

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
                weight
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
            SELECT id, name, x, y, weight, h_index, lat, lon
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

            seed_id, seed_label, seed_x, seed_y, seed_weight, seed_h, seed_lat, seed_lon = seed

            # Find all locations within cluster radius
            cluster_members = []
            for loc in unclustered:
                loc_id, loc_label, loc_x, loc_y, loc_weight, loc_h, loc_lat, loc_lon = loc
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
                        weight
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

                # Create cluster name
                if len(cluster_members) == 1:
                    cluster_label = cluster_members[0][1]
                else:
                    cluster_label = f"{seed_label} and {len(cluster_members) - 1} others"

                # Insert cluster
                self.conn.execute(
                    f"""
                    INSERT INTO clusters (z, h_index, id, name, parent_id, lat, lon, x, y, weight)
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
                        {total_weight}
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

    def _export_results(self, output_file: str) -> None:
        """
        Export clustered results to Parquet file.

        Args:
            output_file: Path to output Parquet file
        """
        self.conn.execute(
            f"""
            COPY (
                SELECT z, h_index, id, name, parent_id, lat, lon, x, y, weight
                FROM clusters
                ORDER BY z DESC, h_index
            ) TO '{output_file}' (FORMAT PARQUET)
            """
        )

