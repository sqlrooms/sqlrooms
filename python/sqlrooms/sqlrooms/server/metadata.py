"""DuckDB metadata storage owned by a runtime instance."""

from typing import Optional


def _quote_ident(ident: str) -> str:
    return '"' + ident.replace('"', '""') + '"'


def _quote_sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


class MetadataStorage:
    def _meta_table_ref(self, table_name: str) -> str:
        if self.meta_namespace is None:
            raise RuntimeError("Meta storage not initialized")
        return f"{_quote_ident(self.meta_namespace)}.{_quote_ident(table_name)}"

    def _sync_rooms_table_ref(self) -> str:
        return self._meta_table_ref("sync_rooms")

    def _ui_state_table_ref(self) -> str:
        return self._meta_table_ref("ui_state")

    def attach_crdt_db(self, path: str) -> None:
        """Attach a separate DuckDB file for CRDT snapshots under the legacy 'crdt' namespace."""
        self.init_meta_storage(namespace="crdt", attached_db_path=path)

    def init_meta_storage(
        self, namespace: str, attached_db_path: Optional[str] = None
    ) -> None:
        """Initialize SQLRooms meta persistence (UI state + CRDT snapshots).

        - If attached_db_path is provided, attach that DuckDB file under the given namespace
          (DuckDB ATTACH alias), and store meta tables in `<namespace>.*`.
        - If attached_db_path is not provided, create a schema within the main DB and store
          meta tables in `<namespace>.*`.
        """
        if self.connection is None:
            raise RuntimeError("Runtime DuckDB connection not initialized")
        if not namespace or not namespace.strip():
            raise ValueError("Meta namespace must be a non-empty string")

        self.meta_namespace = namespace.strip()
        ns_q = _quote_ident(self.meta_namespace)

        if attached_db_path is not None:
            # Note: In DuckDB, the ATTACH alias behaves like a namespace you can qualify with.
            self.connection.execute(
                f"ATTACH {_quote_sql_string(attached_db_path)} AS {ns_q};"
            )
        else:
            # Use a schema within the main database.
            self.connection.execute(f"CREATE SCHEMA IF NOT EXISTS {ns_q};")

        # UI state (single row today, key='default')
        ui_ref = self._ui_state_table_ref()
        self.connection.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {ui_ref} (
                key TEXT PRIMARY KEY,
                payload_json JSON,
                updated_at TIMESTAMPTZ DEFAULT now()
            );
            """
        )

        # CRDT snapshots
        rooms_ref = self._sync_rooms_table_ref()
        self.connection.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {rooms_ref} (
                room_id TEXT PRIMARY KEY,
                snapshot BLOB,
                updated_at TIMESTAMPTZ DEFAULT now()
            );
            """
        )

    def init_crdt_storage(
        self, namespace: str, attached_db_path: Optional[str] = None
    ) -> None:
        """Deprecated: use self.init_meta_storage(). Kept for internal back-compat."""
        self.init_meta_storage(namespace=namespace, attached_db_path=attached_db_path)

    async def load_crdt_snapshot(self, room_id: str) -> Optional[bytes]:
        """Load a CRDT snapshot blob for a room from the configured CRDT namespace."""
        if self.connection is None:
            raise RuntimeError("Runtime DuckDB connection not initialized")
        rooms_ref = self._sync_rooms_table_ref()

        def _load(cur):
            res = cur.execute(
                f"SELECT snapshot FROM {rooms_ref} WHERE room_id = ?", [room_id]
            ).fetchone()
            return None if res is None else res[0]

        return await self.run_db_task(_load)

    async def save_crdt_snapshot(self, room_id: str, snapshot: bytes) -> None:
        """Persist a CRDT snapshot blob for a room into the configured CRDT namespace."""
        if self.connection is None:
            raise RuntimeError("Runtime DuckDB connection not initialized")
        rooms_ref = self._sync_rooms_table_ref()

        def _save(cur):
            cur.execute(
                f"""
                INSERT INTO {rooms_ref}(room_id, snapshot, updated_at)
                VALUES (?, ?, now())
                ON CONFLICT(room_id) DO UPDATE SET snapshot = excluded.snapshot, updated_at = excluded.updated_at
                """,
                [room_id, snapshot],
            )

        await self.run_db_task(_save)
