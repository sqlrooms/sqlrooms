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
    help="Path to output Parquet file",
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
def main(
    locations: str,
    flows: str,
    output: str,
    radius: float,
    min_zoom: int,
    max_zoom: int,
) -> None:
    """Prepare origin-destination datasets for tiling using DuckDB."""
    click.echo("SQLRooms Flowmap Processor")
    click.echo(f"Locations: {locations}")
    click.echo(f"Flows: {flows}")
    click.echo(f"Output: {output}")
    click.echo(f"Cluster radius: {radius} pixels")
    click.echo(f"Zoom range: {min_zoom} - {max_zoom}")

    processor = FlowmapProcessor(
        locations_file=locations,
        flows_file=flows,
        cluster_radius=radius,
        min_zoom=min_zoom,
        max_zoom=max_zoom,
    )

    processor.process(output)
    click.echo(f"\n✓ Complete! Output written to {output}")


if __name__ == "__main__":
    main()

