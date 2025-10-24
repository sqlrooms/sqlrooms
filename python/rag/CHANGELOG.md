# Changelog

All notable changes to sqlrooms-rag will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added markdown-aware chunking by default (splits by headers, preserves section titles)
- Added `--no-markdown-chunking` CLI flag to revert to size-based chunking
- Added HTML tag stripping in topic detection to prevent tags from appearing in topic names

- Added `generate-umap-embeddings` CLI command - Generate 2D UMAP embeddings for visualization from DuckDB embeddings
- Added automatic topic detection and naming using HDBSCAN clustering and TF-IDF keyword extraction
- Added automatic link extraction from markdown to build document graphs (chunk-level sources, expanded to all target chunks)
- Added `topic` column to output Parquet files with descriptive cluster names
- Added `node_id`, `file_path`, `indegree`, `outdegree` columns for network analysis
- Added separate links table (`*_links.parquet`) with `source_id` and `target_id` for network visualization
- Added `--no-topics`, `--min-cluster-size`, and `--no-links` CLI options
- Added `sqlrooms_rag.generate_umap` module with programmatic API for UMAP generation
- Added `VISUALIZATION_GUIDE.md` - Complete guide for embedding visualization with examples
- Added `scripts/README.md` - Documentation for utility scripts with visualization examples
- Added `examples/prepare_duckdb_docs.py` - Script to download DuckDB documentation from GitHub and prepare embeddings
- Added `examples/prepare_duckdb_docs.sh` - Bash version of the DuckDB docs preparation script
- Added `examples/README.md` - Comprehensive documentation for all example scripts
- Added visualization dependencies as optional `viz` extra: `umap-learn`, `pyarrow`, `pandas`, `scikit-learn`, `hdbscan`
- Added `downloaded-docs/` and `*.parquet` to `.gitignore`
- Exported UMAP, clustering, and graph functions in package API: `extract_title_from_markdown`, `extract_filename_from_metadata`, `load_embeddings_from_duckdb`, `generate_umap_embeddings`, `process_embeddings`, `save_to_parquet`, `extract_keywords_from_texts`, `generate_topic_name`, `cluster_documents`, `extract_links_from_markdown`, `normalize_path`, `build_link_graph`, `calculate_graph_metrics`, `create_links_table`

### Fixed

- Fixed issue where database files were created without `.duckdb` extension when specifying full path with extension
- Now properly handles both `path/to/db.duckdb` and `path/to/db` formats
- Automatically creates parent directories if they don't exist
- Suppressed pydantic UserWarning from dependencies (cosmetic fix for cleaner CLI output)

### Changed

- Improved path handling in `prepare.py` to explicitly manage `.duckdb` extension
- `database_name` parameter now includes the `.duckdb` extension for clarity
- Updated README.md with DuckDB documentation preparation example and visualization section
- Enhanced package structure documentation to include new example scripts and utility scripts
- Added visualization installation instructions to README

## [0.1.0] - 2025-10-23

### Added

- Initial release of sqlrooms-rag package
- CLI tool `prepare-embeddings` for creating vector embeddings from markdown files
- Python API with `prepare_embeddings()` function
- Support for HuggingFace embedding models (default: BAAI/bge-small-en-v1.5)
- DuckDB backend for efficient vector storage and retrieval
- Example scripts for querying embeddings with llama-index and direct DuckDB
- Comprehensive documentation (README.md, QUERYING.md, PUBLISHING.md)

### Features

- Recursive markdown file processing
- Configurable chunk sizes (default: 512 tokens)
- Custom embedding model selection
- Progress tracking during embedding generation
- Command-line interface with helpful examples
- Programmatic Python API for integration

[Unreleased]: https://github.com/sqlrooms/sqlrooms/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sqlrooms/sqlrooms/releases/tag/v0.1.0
