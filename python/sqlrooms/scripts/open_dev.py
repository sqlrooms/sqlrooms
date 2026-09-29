"""Open the Vite UI using the running backend's native ticket handoff."""

import argparse
import sys
import time
import webbrowser

import httpx

from sqlrooms.agent import registry


def launch_dev(api_url, *, open_browser=True, timeout=10):
    """Target the exact live backend binding; expose only a one-use page ticket."""
    with httpx.Client(trust_env=False, timeout=2) as client:
        response = client.get(api_url + "/auth.json")
        response.raise_for_status()
        binding = response.json()["binding"]
    deadline = time.monotonic() + timeout
    while True:
        record = next(
            (
                record
                for record in registry.records()
                if record["instanceId"] == binding and record["apiUrl"] == api_url
            ),
            None,
        )
        if record is not None:
            break
        if time.monotonic() >= deadline:
            raise RuntimeError("The dev backend did not publish its native handoff.")
        time.sleep(0.1)
    registry.verify(record)
    url = registry.request(record, "/api/auth/ticket", payload={})["url"]
    opened = open_browser and webbrowser.open_new_tab(url)
    # Tickets belong in the interactive terminal, never in captured build logs.
    if sys.stderr.isatty():
        # Keep the printed link usable even if the automatically opened tab has
        # already redeemed its own single-use ticket.
        terminal_url = (
            registry.request(record, "/api/auth/ticket", payload={})["url"]
            if opened
            else url
        )
        print(
            f"Temporary SQLRooms launch link (valid 2 minutes): {terminal_url}",
            file=sys.stderr,
        )
    elif open_browser and not opened:
        print(
            "Could not open the browser. Run pnpm dev cli in an interactive "
            "terminal to obtain a temporary launch link.",
            file=sys.stderr,
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("api_url")
    parser.add_argument("--no-open-browser", action="store_true")
    args = parser.parse_args()
    launch_dev(args.api_url, open_browser=not args.no_open_browser)
