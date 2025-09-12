import logging
import time
from functools import partial
from pathlib import Path
import os
import asyncio
import concurrent.futures
from typing import Optional, Callable, Any

import ujson
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from pkg.query import run_duckdb

logger = logging.getLogger(__name__)


# Flag to track if shutdown has been requested
shutdown_requested = False

from . import db_async

def make_error_response(code, message):
    error_body = {
        "success": False,
        "error": {
            "message": message,
        }
    }
    return json.dumps(error_body)

# Wait briefly for .wal file to disappear automatically after checkpoint
def _wait_for_wal_disappear(db_path: Optional[str], timeout_sec: float = 1.0, interval_sec: float = 0.05) -> None:
    try:
        if not db_path:
            return
        wal_path = f"{db_path}.wal"
        start = time.time()
        # Wait up to timeout for DuckDB to remove the WAL after FORCE CHECKPOINT
        while os.path.exists(wal_path) and (time.time() - start) < timeout_sec:
            time.sleep(interval_sec)
    except Exception:
        # Best-effort; ignore any issues here
        pass

 

 

class Handler:
    def done(self):
        raise Exception("NotImplementedException")
    def arrow(self, _buffer):
        raise Exception("NotImplementedException")
    def error(self, _error):
        raise Exception("NotImplementedException")

class WebSocketHandler(Handler):
    def __init__(self, ws):
        self.ws = ws
    def done(self):
        pass
    async def arrow(self, buffer):
        await self.ws.send_bytes(buffer)
    async def error(self, error):
        await self.ws.send_text(json.dumps({"error": str(error)}))

def deactivate_backend(cache) -> None:
    """Temporarily deactivate the backend for a connection change.
    - Block new queries
    - Cancel active queries and close their cursors
    - Clear cache
    - FORCE CHECKPOINT and close current GLOBAL_CON
    """
    global shutdown_requested
    # Block new queries while we switch connections
    shutdown_requested = True

    # Cancel/close any active queries
    db_async.cancel_all_queries()

    # Best-effort: clear cache to avoid stale results
    if cache:
        try:
            logger.info("Clearing cache before reconnection...")
            cache.clear()
            logger.info("Cache cleared")
        except Exception as e:
            logger.warning(f"Failed to clear cache (ignored): {e}")

    # Flush pending changes to disk and close current connection
    if db_async.GLOBAL_CON:
        try:
            logger.info("Forcing checkpoint before closing current connection...")
            db_async.GLOBAL_CON.execute("FORCE CHECKPOINT")
            _wait_for_wal_disappear(db_async.DATABASE_PATH)
        except Exception as e:
            logger.warning(f"FORCE CHECKPOINT failed (continuing): {e}")
        try:
            logger.info("Closing current DuckDB connection...")
            db_async.GLOBAL_CON.close()
            logger.info("Closed current DuckDB connection")
        except Exception as e:
            logger.warning(f"Error closing current connection (continuing): {e}")

def activate_backend(new_database_path: str) -> None:
    """Activate the backend by opening a connection to the provided database and resume queries."""
    global shutdown_requested
    logger.info(f"Re-initializing global DuckDB connection to {new_database_path}")
    db_async.init_global_connection(new_database_path)
    logger.info("Global connection re-initialized to new project file")
    # Resume accepting queries
    shutdown_requested = False

async def handle_query(handler: Handler, cache, query, query_id: Optional[str] = None):
    global shutdown_requested
    # Use client-provided query_id if present
    if query_id is None:
        query_id = query.get("queryId") or db_async.generate_query_id()
    logger.debug(f"query={query} (query_id: {query_id})")
    # Check if shutdown has been requested - don't process new queries
    if shutdown_requested:
        logger.warning("Rejecting query because shutdown has been requested")
        await handler.error("Server is shutting down") if hasattr(handler.error, '__await__') else handler.error("Server is shutting down")
        return
    start = time.time()
    try:
        command = query["type"]
        logger.info(f"Processing command: {command} (query_id: {query_id})")
        if "sql" in query:
            sql = query["sql"]
            if len(sql) > 200:
                logger.debug(f"SQL query first 200 chars: {sql[:200]}... (query_id: {query_id})")
            else:
                logger.debug(f"Full SQL query: {sql} (query_id: {query_id})")
        # Only Arrow queries are supported
        if command != "arrow":
            raise ValueError("Only 'arrow' command is supported")

        try:
            result = await run_duckdb(cache, query, query_id=query_id)
            if result["type"] == "arrow":
                await handler.arrow(result["data"]) if hasattr(handler.arrow, '__await__') else handler.arrow(result["data"])
            else:
                raise ValueError("Unexpected result type")
        except concurrent.futures.CancelledError:
            logger.info(f"Query {query_id} was cancelled")
            await handler.error("Query was cancelled") if hasattr(handler.error, '__await__') else handler.error("Query was cancelled")
            return
        except Exception as e:
            logger.exception(f"Error processing command '{command}' (query_id: {query_id}): {str(e)}")
            await handler.error(e) if hasattr(handler.error, '__await__') else handler.error(e)
            return
    except KeyError as e:
        err_msg = f"Missing required key in query: {str(e)}"
        logger.exception(err_msg)
        await handler.error(err_msg) if hasattr(handler.error, '__await__') else handler.error(err_msg)
    except Exception as e:
        logger.exception(f"Error processing query: {str(e)}")
        await handler.error(e) if hasattr(handler.error, '__await__') else handler.error(e)
    total = round((time.time() - start) * 1_000)
    logger.info(f"DONE. Query took {total} ms.")
    
# For backward compatibility for callers importing from pkg.server
init_global_connection = db_async.init_global_connection

def create_app(cache):
    app = FastAPI()

    # Enable CORS similar to falcon.asgi.App(cors_enable=True)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    async def _process_query(ws: WebSocket, cache, query: dict):
        # Extract or assign query id for correlation
        query_id = query.get("queryId") or db_async.generate_query_id()
        try:
            # Run DB work concurrently so we can keep receiving other messages
            result = await run_duckdb(cache, query, query_id=query_id)
            if result["type"] == "arrow":
                # Build binary frame: [4-byte BE header length][header JSON][arrow bytes]
                header_obj = {"type": "arrow", "queryId": query_id}
                header_bytes = json.dumps(header_obj).encode("utf-8")
                header_len = len(header_bytes).to_bytes(4, byteorder="big")
                payload = header_len + header_bytes + result["data"]
                await ws.send_bytes(payload)
            else:
                await ws.send_text(json.dumps({
                    "type": "error",
                    "queryId": query_id,
                    "error": "Unexpected result type",
                }))
        except concurrent.futures.CancelledError:
            await ws.send_text(json.dumps({
                "type": "error",
                "queryId": query_id,
                "error": "Query was cancelled",
            }))
        except Exception as e:
            logger.exception("Error executing query")
            await ws.send_text(json.dumps({
                "type": "error",
                "queryId": query_id,
                "error": str(e),
            }))

    @app.websocket("/ws")
    async def websocket_endpoint(ws: WebSocket):
        await ws.accept()
        try:
            while True:
                message = await ws.receive_text()
                try:
                    query = ujson.loads(message)
                    # Support explicit per-query cancellation over WebSocket
                    if isinstance(query, dict) and query.get("type") == "cancel":
                        qid = query.get("queryId")
                        if not qid:
                            await ws.send_text(json.dumps({
                                "type": "cancelAck",
                                "cancelled": False,
                                "error": "Missing queryId in cancel message",
                            }))
                        else:
                            ok = db_async.cancel_query(qid)
                            await ws.send_text(json.dumps({
                                "type": "cancelAck",
                                "queryId": qid,
                                "cancelled": bool(ok),
                            }))
                        continue

                    # Simple notify echo for client-driven notifications
                    if isinstance(query, dict) and query.get("type") == "notify":
                        payload = query.get("payload")
                        await ws.send_text(json.dumps({
                            "type": "notify",
                            "payload": payload,
                        }))
                        continue

                    # For query messages (e.g., { type: 'arrow', sql, queryId? }),
                    # spawn a background task so this connection can continue
                    # receiving messages (e.g., more queries, cancel requests, notifications).
                    asyncio.create_task(_process_query(ws, cache, query))
                except Exception as e:
                    logger.exception("Error processing WebSocket message")
                    await ws.send_text(json.dumps({"error": str(e)}))
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected")

    return app

def server(cache, port=4000):
    import uvicorn
    app = create_app(cache)
    logger.info(f"FastAPI DuckDB Server listening at ws://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
