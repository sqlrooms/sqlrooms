"""
Embedding preparation module.

This module provides functionality for:
- Loading and parsing markdown documents
- Creating text chunks using markdown-aware or size-based strategies
- Generating embeddings using HuggingFace or OpenAI models
- Storing embeddings in DuckDB for efficient retrieval
- Creating full-text search indexes for hybrid retrieval
- Storing metadata for reproducibility and validation
"""

from .core import prepare_embeddings
from .chunking import count_tokens, validate_and_split_chunks
from .embeddings import get_embedding_model
from .database import (
    create_source_documents_table,
    add_document_references,
    create_fts_index,
)
from .metadata import (
    calculate_chunk_stats,
    create_metadata,
    store_metadata_in_db,
    save_metadata_yaml,
)

__all__ = [
    # Main function
    "prepare_embeddings",
    # Chunking utilities
    "count_tokens",
    "validate_and_split_chunks",
    # Embedding utilities
    "get_embedding_model",
    # Database utilities
    "create_source_documents_table",
    "add_document_references",
    "create_fts_index",
    # Metadata utilities
    "calculate_chunk_stats",
    "create_metadata",
    "store_metadata_in_db",
    "save_metadata_yaml",
]

