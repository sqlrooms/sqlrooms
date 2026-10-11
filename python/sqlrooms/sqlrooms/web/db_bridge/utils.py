from __future__ import annotations

from typing import Any, Iterable

import pyarrow as pa


def cursor_columns(cursor: Any) -> list[str]:
    description = getattr(cursor, "description", None) or []
    columns: list[str] = []
    for item in description:
        if hasattr(item, "name"):
            columns.append(str(item.name))
        elif isinstance(item, (list, tuple)) and item:
            columns.append(str(item[0]))
    return columns


def rows_to_json_rows(
    rows: Iterable[Iterable[Any]],
    columns: list[str],
) -> list[dict[str, Any]]:
    return [dict(zip(columns, row)) for row in rows]


def rows_to_arrow_bytes(
    rows: Iterable[Iterable[Any]],
    columns: list[str],
) -> bytes:
    json_rows = rows_to_json_rows(rows, columns)
    if json_rows:
        table = pa.Table.from_pylist(json_rows)
    elif columns:
        table = pa.table({column: pa.array([], type=pa.null()) for column in columns})
    else:
        table = pa.table({})

    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    return sink.getvalue().to_pybytes()


def quoted_ident(ident: str) -> str:
    return '"' + ident.replace('"', '""') + '"'
