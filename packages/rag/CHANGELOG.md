# Changelog

All notable changes to `@sqlrooms/rag` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Text Query Support** - New `queryByText()` method to query embeddings using plain text
- **Embedding Providers** - Configurable embedding generation via `EmbeddingProvider` type
- **Dynamic Provider Configuration** - `setEmbeddingProvider()` method to set or update providers after store creation
- Optional `embeddingProvider` parameter in `createRagSlice()` for automatic embedding generation
- New type export: `EmbeddingProvider`
- Comprehensive documentation for embedding providers (EMBEDDING_PROVIDERS.md)
- Quick reference guide for text query options (TEXT_QUERY_OPTIONS.md)

### Changed

- Enhanced `createRagSlice()` to accept optional `embeddingProvider` parameter
- Updated README with text query examples and embedding provider documentation
- Improved API documentation with examples for new methods

### Features

Users can now:

- Query with plain text instead of pre-computed embeddings
- Use multiple embedding providers (OpenAI, Transformers.js, Cohere, custom APIs)
- Switch between providers dynamically at runtime
- Continue using `queryEmbeddings()` for manual embedding generation

## [0.1.0] - Initial Release

### Added

- Core RAG slice implementation with `createRagSlice()`
- Vector similarity search using DuckDB's `array_cosine_similarity()`
- Multi-database support for searching across multiple embedding databases
- `initialize()` method to attach embedding databases
- `queryEmbeddings()` method for vector similarity queries
- `listDatabases()` method to list attached databases
- Full TypeScript type definitions
- Comprehensive README with usage examples
- Integration examples (EXAMPLE.md)
