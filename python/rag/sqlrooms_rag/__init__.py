"""
SQLRooms RAG Embedding Utilities

Tools for preparing and querying vector embeddings stored in DuckDB.
"""

__version__ = "0.1.0"

from .prepare import prepare_embeddings
from .generate_umap import (
    extract_title_from_markdown,
    extract_filename_from_metadata,
    extract_filepath_from_metadata,
    make_relative_path,
    load_embeddings_from_duckdb,
    generate_umap_embeddings,
    process_embeddings,
    save_to_parquet,
    clean_html_tags,
    extract_keywords_from_texts,
    generate_topic_name,
    cluster_documents,
    extract_links_from_markdown,
    normalize_path,
    build_link_graph,
    calculate_graph_metrics,
    create_links_table,
)

__all__ = [
    "prepare_embeddings",
    "extract_title_from_markdown",
    "extract_filename_from_metadata",
    "extract_filepath_from_metadata",
    "make_relative_path",
    "load_embeddings_from_duckdb",
    "generate_umap_embeddings",
    "process_embeddings",
    "save_to_parquet",
    "clean_html_tags",
    "extract_keywords_from_texts",
    "generate_topic_name",
    "cluster_documents",
    "extract_links_from_markdown",
    "normalize_path",
    "build_link_graph",
    "calculate_graph_metrics",
    "create_links_table",
]

