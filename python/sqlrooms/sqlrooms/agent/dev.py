"""Authenticated development launch, shared by local applications."""

import sys
import time
import webbrowser
import httpx
from . import registry


def launch_dev(
    api_url, *, open_browser=True, timeout=10, settings=None, expected_pid=None
):
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
                for record in registry.records(settings=settings)
                if record["instanceId"] == binding
                and record["apiUrl"] == api_url
                and (expected_pid is None or record["pid"] == expected_pid)
            ),
            None,
        )
        if record is not None:
            break
        if time.monotonic() >= deadline:
            raise RuntimeError("The dev backend did not publish its native handoff.")
        time.sleep(0.1)
    registry.verify(record, settings=settings)
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
            f"Temporary {settings.name if settings else 'SQLRooms'} launch link (valid 2 minutes): {terminal_url}",
            file=sys.stderr,
        )
    elif open_browser and not opened:
        print(
            "Could not open the browser. Run pnpm dev cli in an interactive "
            "terminal to obtain a temporary launch link.",
            file=sys.stderr,
        )
