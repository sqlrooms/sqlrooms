"""Open the Vite UI using the running backend's native ticket handoff."""

import argparse
from sqlrooms.agent.dev import launch_dev


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("api_url")
    parser.add_argument("--no-open-browser", action="store_true")
    args = parser.parse_args()
    launch_dev(args.api_url, open_browser=not args.no_open_browser)
