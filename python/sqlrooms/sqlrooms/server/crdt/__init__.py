"""
CRDT support for sqlrooms-server.

This package encapsulates:
- Room doc state management and persistence (`CrdtState`)
- WebSocket protocol handlers for CRDT join/update/snapshot (`CrdtWs`)
"""

from .state import CrdtState, RoomDoc
from .ws import CrdtWs

__all__ = ["CrdtState", "RoomDoc", "CrdtWs"]
