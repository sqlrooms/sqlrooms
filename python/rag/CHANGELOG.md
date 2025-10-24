# Changelog

All notable changes to sqlrooms-rag will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added `examples/prepare_duckdb_docs.py` - Script to download DuckDB documentation from GitHub and prepare embeddings
- Added `examples/prepare_duckdb_docs.sh` - Bash version of the DuckDB docs preparation script
- Added `examples/README.md` - Comprehensive documentation for all example scripts
- Added `downloaded-docs/` to `.gitignore` to exclude downloaded documentation from version control

### Fixed

- Fixed issue where database files were created without `.duckdb` extension when specifying full path with extension
- Now properly handles both `path/to/db.duckdb` and `path/to/db` formats
- Automatically creates parent directories if they don't exist
- Suppressed pydantic UserWarning from dependencies (cosmetic fix for cleaner CLI output)

### Changed

- Improved path handling in `prepare.py` to explicitly manage `.duckdb` extension
- `database_name` parameter now includes the `.duckdb` extension for clarity
- Updated README.md with DuckDB documentation preparation example
- Enhanced package structure documentation to include new example scripts

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
