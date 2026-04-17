#!/usr/bin/env -S uv run --with duckdb python
"""
Regenerate `public/earthquakes.parquet` from the USGS FDSN event feed.

DuckDB auto-infers the `time` column as TIMESTAMPTZ; we downcast to plain
TIMESTAMP at convert time so the in-browser `strftime`/`EPOCH` calls work
without further casting. Tuned to M5+ since 2013 (~17k events) — right at
the sweet spot of "covers every subduction-zone preset" and "stays under
the USGS 20,000-row API limit".

Run this whenever you want fresh data:

    examples/cesium-app/scripts/fetch-earthquakes.py
"""

import os
import sys
import duckdb

URL = (
    "https://earthquake.usgs.gov/fdsnws/event/1/query"
    "?format=csv&starttime=2013-01-01&minmagnitude=5&limit=20000&orderby=time-asc"
)
OUT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..",
    "public",
    "earthquakes.parquet",
)

os.makedirs(os.path.dirname(OUT), exist_ok=True)

print(f"Fetching {URL}", file=sys.stderr)
duckdb.sql(
    f"COPY (SELECT * REPLACE (CAST(time AS TIMESTAMP) AS time) "
    f"FROM read_csv_auto('{URL}')) "
    f"TO '{OUT}' (FORMAT 'parquet', COMPRESSION 'zstd')"
)

size_kb = os.path.getsize(OUT) / 1024
row_count = duckdb.sql(f"SELECT COUNT(*) FROM read_parquet('{OUT}')").fetchone()[0]
print(f"Wrote {OUT}: {row_count} rows, {size_kb:.1f} KB", file=sys.stderr)
