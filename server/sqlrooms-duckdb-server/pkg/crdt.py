import logging
import threading
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from loro import LoroDoc, ExportMode

logger = logging.getLogger(__name__)


@dataclass
class DocEntry:
    doc: LoroDoc
    lock: threading.Lock


class LoroDocManager:
    """In-memory manager for Loro documents keyed by (doc_id, branch).

    Persistence strategy (ops log + snapshots) is intentionally left to callers.
    This manager focuses on holding live docs for WS sessions and merging updates.
    """

    def __init__(self) -> None:
        self._docs: Dict[Tuple[str, str], DocEntry] = {}
        self._lock = threading.Lock()

    def get_or_create(self, doc_id: str, branch: str = "main") -> LoroDoc:
        key = (doc_id, branch)
        with self._lock:
            entry = self._docs.get(key)
            if entry is None:
                doc = LoroDoc()
                entry = DocEntry(doc=doc, lock=threading.Lock())
                self._docs[key] = entry
            return entry.doc

    def import_update(self, doc_id: str, branch: str, update: bytes) -> None:
        key = (doc_id, branch)
        with self._lock:
            entry = self._docs.get(key)
            if entry is None:
                doc = LoroDoc()
                entry = DocEntry(doc=doc, lock=threading.Lock())
                self._docs[key] = entry
        # Import outside global lock, use per-doc lock
        with entry.lock:
            try:
                entry.doc.import_(update)
            except Exception as e:
                logger.exception("Failed to import Loro update")
                raise e

    def export_state(self, doc_id: str, branch: str = "main") -> bytes:
        doc = self.get_or_create(doc_id, branch)
        return doc.export(ExportMode.Snapshot())

    def export_update(self, doc_id: str, branch: str = "main") -> bytes:
        doc = self.get_or_create(doc_id, branch)
        return doc.export(ExportMode.Updates())


