"""
SQLRooms RAG Embedding Utilities

Tools for preparing and querying vector embeddings stored in DuckDB.
"""

__version__ = "0.1.0"

from .prepare import prepare_embeddings
from .generate_umap import (
    extract_title_from_markdown,
    extract_filename_from_metadata,
    load_embeddings_from_duckdb,
    generate_umap_embeddings,
    process_embeddings,
    save_to_parquet,
    extract_keywords_from_texts,
    generate_topic_name,
    cluster_documents,
)

__all__ = [
    "prepare_embeddings",
    "extract_title_from_markdown",
    "extract_filename_from_metadata",
    "load_embeddings_from_duckdb",
    "generate_umap_embeddings",
    "process_embeddings",
    "save_to_parquet",
    "extract_keywords_from_texts",
    "generate_topic_name",
    "cluster_documents",
]

