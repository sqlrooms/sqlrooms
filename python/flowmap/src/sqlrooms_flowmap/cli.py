"""Command-line interface for sqlrooms-flowmap."""

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
    "--output",
    required=True,
    type=click.Path(),
    help="Path to output Parquet file for clusters",
)
@click.option(
    "--flows-output",
    type=click.Path(),
    help="Path to output Parquet file for tiled flows (optional)",
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
def main(
    locations: str,
    flows: str,
    output: str,
    flows_output: str,
    radius: float,
    min_zoom: int,
    max_zoom: int,
    time_bucket: str,
    time_zone: str,
) -> None:
    """Prepare origin-destination datasets for tiling using DuckDB."""
    click.echo("SQLRooms Flowmap Processor")
    click.echo(f"Locations: {locations}")
    click.echo(f"Flows: {flows}")
    click.echo(f"Clusters output: {output}")
    if flows_output:
        click.echo(f"Flows output: {flows_output}")
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

    processor.process(output, flows_output)
    click.echo(f"\n✓ Complete! Clusters written to {output}")
    if flows_output:
        click.echo(f"✓ Flows written to {flows_output}")


if __name__ == "__main__":
    main()

