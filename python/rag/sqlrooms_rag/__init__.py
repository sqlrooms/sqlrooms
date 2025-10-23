"""
SQLRooms RAG Embedding Utilities

Tools for preparing and querying vector embeddings stored in DuckDB.
"""

__version__ = "0.1.0"

from .prepare import prepare_embeddings

__all__ = ["prepare_embeddings"]

