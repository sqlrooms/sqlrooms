"""One-time setup and stable runtime adapter commands."""

import asyncio
import json
from importlib.metadata import version
import sys

import typer

from .storage import WorkspaceError, home, managed_root

agent_app = typer.Typer(
    help="Set up an agent connection and manage local workspace discovery.",
    pretty_exceptions_enable=False,
)


@agent_app.command()
def connect():
    """Serve lifecycle/catalog and explicitly targeted workspace tools over MCP stdio."""
    from .connector import Connector

    asyncio.run(Connector().run())


@agent_app.command()
def status():
    """Report saved workspaces, verified runtimes, and redacted connection diagnostics."""
    from .manager import Manager

    try:
        value = {
            "python": sys.executable,
            "module": "sqlrooms",
            "versions": {name: version(name) for name in ("sqlrooms", "mcp")},
            "catalog": str(home() / "workspaces.json"),
            "managedRoot": str(managed_root()),
            **Manager().list(limit=200),
        }
    except WorkspaceError as exc:
        value = exc.result
    typer.echo(json.dumps(value, indent=2))


@agent_app.command()
def setup(
    client: str | None = typer.Option(None),
    yes: bool = typer.Option(
        False,
        "--yes",
        help="Apply the selected client configuration and listed tool permissions, without installing software.",
    ),
    dry_run: bool = typer.Option(False, "--dry-run"),
    uninstall: bool = typer.Option(False, "--uninstall"),
    trust_tools: bool | None = typer.Option(
        None,
        "--trust-tools/--no-trust-tools",
        help="Trust the listed SQLRooms tools in Claude Code (recommended). Browser database approvals remain active. Opt out to remove only SQLRooms-managed allow entries.",
    ),
):
    """Preview and explicitly accept client configuration; never install optional dependencies."""
    from .setup import apply_setup, setup_plan

    try:
        if client is None:
            if yes or not sys.stdin.isatty():
                raise WorkspaceError(
                    "client_required",
                    "Noninteractive setup requires --client and --yes (or --dry-run).",
                )
            client = typer.prompt(
                "Client (claude-desktop or claude-code)", default="claude-desktop"
            )
        if (
            client == "claude-code"
            and trust_tools is None
            and not (yes or dry_run or uninstall)
            and sys.stdin.isatty()
        ):
            typer.echo(
                "Trust includes workspace lifecycle actions and document edits. SQLRooms browser approval still protects database writes and external reads."
            )
            trust_tools = typer.confirm(
                "Trust SQLRooms tools in Claude Code? (recommended)", default=True
            )
        plan = setup_plan(
            client, uninstall=uninstall, trust_tools=trust_tools is not False
        )
        typer.echo(json.dumps(plan, indent=2))
        if dry_run:
            return
        if not yes and (
            not sys.stdin.isatty()
            or not typer.confirm("Apply this configuration change?", default=False)
        ):
            typer.echo("No changes made.")
            return
        typer.echo(json.dumps(apply_setup(plan), indent=2))
    except WorkspaceError as exc:
        typer.echo(json.dumps(exc.result), err=True)
        raise typer.Exit(1) from exc
