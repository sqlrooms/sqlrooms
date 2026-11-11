"""Host configuration and shared explicitly targeted stdio lifecycle."""

import argparse
import asyncio
import json
import sys
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
    setup.add_argument(
        "--client",
        choices=["claude-code", "codex"],
        help="Preview a client integration; omit to choose interactively",
    )
    setup.add_argument(
        "--apply",
        action="store_true",
        help="Apply the preview, preserving unrelated host entries",
    )
    args = parser.parse_args(argv)
    if args.command == "setup" and args.apply and not args.client:
        parser.error("--apply requires --client claude-code or --client codex")
    if args.command == "connect":
        asyncio.run(Connector(settings=settings()).run())
    elif args.command == "status":
        print(json.dumps(Manager(Catalog(settings())).list(), indent=2))
    else:
        from .setup import configure, setup_interactively, print_manual_setup
        from sqlrooms.agent.storage import WorkspaceError

        try:
            if args.client:
                print(json.dumps(configure(args.client, apply=args.apply), indent=2))
            elif sys.stdin.isatty() and sys.stdout.isatty():
                setup_interactively()
            else:
                setup.print_help()
                print_manual_setup()
        except (EOFError, KeyboardInterrupt):
            print("\nSetup cancelled. No further changes made.", file=sys.stderr)
            raise SystemExit(130) from None
        except WorkspaceError as exc:
            print(json.dumps(exc.result, indent=2), file=sys.stderr)
            raise SystemExit(1) from None
