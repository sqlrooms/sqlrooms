"""Command-line interface for sqlrooms-flowmap."""

import os
from pathlib import Path

import click

from .processor import FlowmapProcessor


@click.command()
@click.option(
    "--locations",
    required=True,
    type=click.Path(exists=True),
    help="Path to locations file (CSV or Parquet)",
)
@click.option(
    "--flows",
    required=True,
    type=click.Path(exists=True),
    help="Path to flows file (CSV or Parquet)",
)
@click.option(
    "--output-dir",
    required=True,
    type=click.Path(),
    help="Output directory for generated Parquet files",
)
@click.option(
    "--radius",
    default=40.0,
    type=float,
    help="Cluster radius in pixels (default: 40)",
)
@click.option(
    "--min-zoom",
    default=0,
    type=int,
    help="Minimum zoom level (default: 0)",
)
@click.option(
    "--max-zoom",
    default=20,
    type=int,
    help="Maximum zoom level (default: 20)",
)
@click.option(
    "--time-bucket",
    type=click.Choice(["hour", "day", "week", "month", "year"], case_sensitive=False),
    help="Temporal aggregation bucket (optional)",
)
@click.option(
    "--time-zone",
    default="UTC",
    type=str,
    help="Time zone for temporal aggregation (default: UTC)",
)
@click.option(
    "--skip-flows",
    is_flag=True,
    help="Skip flow tiling (only generate clusters)",
)
def main(
    locations: str,
    flows: str,
    output_dir: str,
    radius: float,
    min_zoom: int,
    max_zoom: int,
    time_bucket: str,
    time_zone: str,
    skip_flows: bool,
) -> None:
    """Prepare origin-destination datasets for tiling using DuckDB."""
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Derive base name from locations file
    base_name = Path(locations).stem
    
    # Generate output file paths
    clusters_output = os.path.join(output_dir, f"{base_name}-clusters.parquet")
    flows_output = None if skip_flows else os.path.join(output_dir, f"{base_name}-flows.parquet")
    
    click.echo("SQLRooms Flowmap Processor")
    click.echo(f"Locations: {locations}")
    click.echo(f"Flows: {flows}")
    click.echo(f"Output directory: {output_dir}")
    click.echo(f"  → Clusters: {base_name}-clusters.parquet")
    if not skip_flows:
        click.echo(f"  → Flows: {base_name}-flows.parquet")
    click.echo(f"Cluster radius: {radius} pixels")
    click.echo(f"Zoom range: {min_zoom} - {max_zoom}")
    if time_bucket:
        click.echo(f"Temporal aggregation: {time_bucket} ({time_zone})")

    processor = FlowmapProcessor(
        locations_file=locations,
        flows_file=flows,
        cluster_radius=radius,
        min_zoom=min_zoom,
        max_zoom=max_zoom,
        time_bucket=time_bucket,
        time_zone=time_zone,
    )

    processor.process(clusters_output, flows_output)
    click.echo(f"\n✓ Complete!")
    click.echo(f"  Clusters: {clusters_output}")
    if flows_output:
        click.echo(f"  Flows: {flows_output}")


if __name__ == "__main__":
    main()

