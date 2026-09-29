"""Host configuration and shared explicitly targeted stdio lifecycle."""

import argparse
import asyncio
import json
from sqlrooms.agent.catalog import Catalog
from sqlrooms.agent.connector import Connector
from sqlrooms.agent.manager import Manager
from .settings import settings


def main(argv):
    parser = argparse.ArgumentParser(prog="roomie agent")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("connect")
    sub.add_parser("status")
    setup = sub.add_parser("setup")
    setup.add_argument("--client", choices=["claude-code", "codex"], required=True)
    setup.add_argument(
        "--apply",
        action="store_true",
        help="Apply the preview, preserving unrelated host entries",
    )
    args = parser.parse_args(argv)
    if args.command == "connect":
        asyncio.run(Connector(settings=settings()).run())
    elif args.command == "status":
        print(json.dumps(Manager(Catalog(settings())).list(), indent=2))
    else:
        from .setup import configure

        print(json.dumps(configure(args.client, apply=args.apply), indent=2))
