from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any, Iterable

import duckdb


def _to_json(value: Any) -> str:
    return json.dumps(value or {}, ensure_ascii=False)


class DuckDBStateStore:
    """
    Persists SQLRooms UI state inside the DuckDB database.

    The state is split across the __sqlrooms schema:
    - layout, ai_settings, ai, sql_editor store the latest JSON payloads.
    - ai_sessions / ai_messages keep per-session breakdowns.
    - sql_editor_queries stores saved/last queries.
    """

    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self._ensure_schema()

    def _connect(self):
        return duckdb.connect(str(self.db_path), read_only=False)

    def _ensure_schema(self) -> None:
        with self._connect() as con:
            con.execute("CREATE SCHEMA IF NOT EXISTS __sqlrooms")
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS __sqlrooms.layout (
                    id TEXT PRIMARY KEY,
                    payload JSON,
                    updated_at TIMESTAMP DEFAULT now()
                )
                """
            )
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS __sqlrooms.ai_settings (
                    id TEXT PRIMARY KEY,
                    payload JSON,
                    updated_at TIMESTAMP DEFAULT now()
                )
                """
            )
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS __sqlrooms.ai (
                    id TEXT PRIMARY KEY,
                    payload JSON,
                    updated_at TIMESTAMP DEFAULT now()
                )
                """
            )
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS __sqlrooms.ai_sessions (
                    session_id TEXT PRIMARY KEY,
                    name TEXT,
                    model_provider TEXT,
                    model TEXT,
                    payload JSON,
                    updated_at TIMESTAMP DEFAULT now()
                )
                """
            )
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS __sqlrooms.ai_messages (
                    id TEXT,
                    session_id TEXT,
                    role TEXT,
                    payload JSON,
                    updated_at TIMESTAMP DEFAULT now(),
                    PRIMARY KEY (id, session_id)
                )
                """
            )
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS __sqlrooms.sql_editor (
                    id TEXT PRIMARY KEY,
                    payload JSON,
                    updated_at TIMESTAMP DEFAULT now()
                )
                """
            )
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS __sqlrooms.sql_editor_queries (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    sql TEXT,
                    payload JSON,
                    updated_at TIMESTAMP DEFAULT now()
                )
                """
            )

    def clear(self) -> None:
        with self._connect() as con:
            con.execute("DELETE FROM __sqlrooms.layout")
            con.execute("DELETE FROM __sqlrooms.ai_settings")
            con.execute("DELETE FROM __sqlrooms.ai")
            con.execute("DELETE FROM __sqlrooms.ai_sessions")
            con.execute("DELETE FROM __sqlrooms.ai_messages")
            con.execute("DELETE FROM __sqlrooms.sql_editor")
            con.execute("DELETE FROM __sqlrooms.sql_editor_queries")

    def _save_singleton(self, con, table: str, payload: Any) -> None:
        con.execute(f"DELETE FROM __sqlrooms.{table} WHERE id = 'default'")
        con.execute(
            f"INSERT INTO __sqlrooms.{table} (id, payload, updated_at) VALUES (?, ?, now())",
            ("default", _to_json(payload)),
        )

    def save_state(self, persisted: dict[str, Any]) -> None:
        if not isinstance(persisted, dict):
            return
        with self._connect() as con:
            if "layout" in persisted:
                self._save_singleton(con, "layout", persisted["layout"])
            if "aiSettings" in persisted:
                self._save_singleton(con, "ai_settings", persisted["aiSettings"])
            if "sqlEditor" in persisted:
                self._save_sql_editor(con, persisted["sqlEditor"])
            if "ai" in persisted:
                self._save_ai(con, persisted["ai"])

    def _save_ai(self, con, ai_state: Any) -> None:
        self._save_singleton(con, "ai", ai_state)
        sessions: Iterable[dict[str, Any]] = ai_state.get("sessions") or []
        con.execute("DELETE FROM __sqlrooms.ai_sessions")
        con.execute("DELETE FROM __sqlrooms.ai_messages")
        for session in sessions:
            sid = str(
                session.get("id")
                or session.get("sessionId")
                or uuid.uuid4().hex
            )
            con.execute(
                """
                INSERT OR REPLACE INTO __sqlrooms.ai_sessions (session_id, name, model_provider, model, payload, updated_at)
                VALUES (?, ?, ?, ?, ?, now())
                """,
                (
                    sid,
                    session.get("name"),
                    session.get("modelProvider"),
                    session.get("model"),
                    _to_json(session),
                ),
            )
            for msg in session.get("analysisResults") or []:
                mid = str(msg.get("id") or uuid.uuid4().hex)
                con.execute(
                    """
                    INSERT OR REPLACE INTO __sqlrooms.ai_messages (id, session_id, role, payload, updated_at)
                    VALUES (?, ?, ?, ?, now())
                    """,
                    (
                        mid,
                        sid,
                        msg.get("role") or msg.get("type"),
                        _to_json(msg),
                    ),
                )

    def _save_sql_editor(self, con, editor_state: Any) -> None:
        self._save_singleton(con, "sql_editor", editor_state)
        queries = (
            editor_state.get("queries")
            or editor_state.get("queryHistory")
            or []
        )
        con.execute("DELETE FROM __sqlrooms.sql_editor_queries")
        for query in queries:
            qid = str(query.get("id") or query.get("queryId") or uuid.uuid4().hex)
            con.execute(
                """
                INSERT OR REPLACE INTO __sqlrooms.sql_editor_queries (id, title, sql, payload, updated_at)
                VALUES (?, ?, ?, ?, now())
                """,
                (
                    qid,
                    query.get("title") or query.get("name"),
                    query.get("sql") or query.get("query"),
                    _to_json(query),
                ),
            )

    def load_state(self) -> dict[str, Any]:
        state: dict[str, Any] = {}

        def _load_single(table: str) -> Any:
            with self._connect() as con:
                row = con.execute(
                    f"SELECT payload FROM __sqlrooms.{table} WHERE id = 'default' LIMIT 1"
                ).fetchone()
                if row and row[0] is not None:
                    try:
                        return json.loads(row[0])
                    except Exception:
                        return None
                return None

        layout = _load_single("layout")
        if layout is not None:
            state["layout"] = layout

        ai_settings = _load_single("ai_settings")
        if ai_settings is not None:
            state["aiSettings"] = ai_settings

        sql_editor = _load_single("sql_editor")
        if sql_editor is not None:
            state["sqlEditor"] = sql_editor

        ai = _load_single("ai")
        if ai is not None:
            state["ai"] = ai

        return state

