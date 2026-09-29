"""Issue the Vite page ticket only after verifying the intended Roomie binding."""

import argparse
from sqlrooms.agent.dev import launch_dev
from roomie.settings import settings

parser = argparse.ArgumentParser()
parser.add_argument("api_url")
parser.add_argument("--pid", type=int, required=True)
parser.add_argument("--no-open-browser", action="store_true")
args = parser.parse_args()
launch_dev(
    args.api_url,
    open_browser=not args.no_open_browser,
    settings=settings(),
    expected_pid=args.pid,
)
