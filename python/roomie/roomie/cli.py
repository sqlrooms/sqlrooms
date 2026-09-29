"""Roomie's deliberately fixed CLI surface."""

import argparse
import asyncio
import os
import sys
from . import __version__


def main():
    parser = argparse.ArgumentParser(
        prog="roomie", description="Local DuckDB documents; external AI through MCP."
    )
    parser.add_argument("--version", action="version", version="Roomie " + __version__)
    if len(sys.argv) > 1 and sys.argv[1] == "agent":
        from .agent import main as agent_main

        return agent_main(sys.argv[2:])
    parser.add_argument("database", nargs="?", default=":memory:")
    parser.add_argument("--db-path")
    parser.add_argument("--port", type=int, default=0)
    parser.add_argument("--no-open-browser", action="store_true")
    parser.add_argument("--external-url", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("--port must be between 0 and 65535")
    if args.db_path and args.database != ":memory:":
        parser.error("Choose a positional database or --db-path")
    if os.environ.get("ROOMIE_MANAGED_LOG"):
        import logging
        from logging.handlers import RotatingFileHandler

        handler = RotatingFileHandler(
            os.environ["ROOMIE_MANAGED_LOG"], maxBytes=1024 * 1024, backupCount=2
        )
        logging.basicConfig(handlers=[handler], level=logging.INFO)
    from .server import RoomieServer

    try:
        asyncio.run(
            RoomieServer(
                args.db_path or args.database,
                port=args.port,
                external_url=args.external_url,
            ).start(open_browser=not args.no_open_browser)
        )
    except (RuntimeError, ValueError, OSError) as exc:
        import logging

        logging.exception("Roomie startup/shutdown failed")
        print(f"Roomie: {exc}", file=sys.stderr)
        raise SystemExit(1) from None
