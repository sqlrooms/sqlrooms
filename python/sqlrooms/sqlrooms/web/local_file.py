"""Resolve import sources on the DuckDB host, without reading or executing SQL."""

import asyncio
import threading
from pathlib import Path
from fastapi import Request
from fastapi.responses import JSONResponse


def _resolve(body):
    """Validate a regular file without running SQL or loading its contents."""
    try:
        if not isinstance(body, dict) or set(body) - {"path", "format"}:
            raise ValueError(
                "Provide path and an optional csv, parquet, or json format."
            )
        raw = body.get("path")
        if not isinstance(raw, str) or not raw.strip() or "://" in raw or "\0" in raw:
            raise ValueError("Provide a local file path, not a URL.")
        path = Path(raw).expanduser().resolve(strict=True)
        if any(char in str(path) for char in "*?[]"):
            raise ValueError(
                "File paths containing glob characters (* ? [ ]) are not supported. Rename the file or its parent directory before importing."
            )
        if not path.is_file():
            raise ValueError("The import source must be a regular file.")
        # Check readability without materializing file contents in Python.
        with path.open("rb"):
            pass
        suffixes = path.suffixes
        suffix = (
            suffixes[-2]
            if len(suffixes) > 1 and suffixes[-1].lower() in {".gz", ".zst"}
            else path.suffix
        )
        format = body.get(
            "format",
            {
                ".csv": "csv",
                ".parquet": "parquet",
                ".json": "json",
                ".jsonl": "json",
                ".ndjson": "json",
            }.get(suffix.lower()),
        )
        if not isinstance(format, str) or format not in {"csv", "parquet", "json"}:
            raise ValueError("Specify csv, parquet, or json for this file.")
        return JSONResponse({"path": str(path), "format": format})
    except (OSError, ValueError, RuntimeError) as exc:
        return JSONResponse(
            {"ok": False, "code": "invalid_import_source", "message": str(exc)},
            status_code=400,
        )


_slots = threading.BoundedSemaphore(4)


async def resolve_local_file(request: Request):
    """Bound filesystem work so a stalled mount cannot block control or shutdown."""
    try:
        body = await request.json()
    except ValueError:
        return JSONResponse({"message": "Invalid JSON input."}, status_code=400)
    if not _slots.acquire(blocking=False):
        return JSONResponse(
            {"message": "Local file resolution is busy; retry later."}, status_code=503
        )
    loop = asyncio.get_running_loop()
    result = loop.create_future()

    def complete(value):
        if not result.done():
            result.set_result(value)

    def worker():
        try:
            value = _resolve(body)
            try:
                loop.call_soon_threadsafe(complete, value)
            except RuntimeError:
                pass  # Server shut down while an unavailable mount was resolving.
        finally:
            _slots.release()

    threading.Thread(target=worker, daemon=True, name="sqlrooms-file-resolve").start()
    try:
        return await asyncio.wait_for(result, timeout=2)
    except asyncio.TimeoutError:
        return JSONResponse(
            {"message": "Local file resolution timed out. Check the drive and retry."},
            status_code=408,
        )
