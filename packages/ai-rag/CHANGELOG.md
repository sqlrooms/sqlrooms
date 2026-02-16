# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.27.0-rc.5](https://github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.4...v0.27.0-rc.5) (2026-02-14)

**Note:** Version bump only for package @sqlrooms/ai-rag

# [0.27.0-rc.4](https://github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.3...v0.27.0-rc.4) (2026-02-11)

**Note:** Version bump only for package @sqlrooms/ai-rag

# [0.27.0-rc.3](https://github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.2...v0.27.0-rc.3) (2026-02-05)

### Bug Fixes

* eslint configuration ([#317](https://github.com/sqlrooms/sqlrooms/issues/317)) ([24b8619](https://github.com/sqlrooms/sqlrooms/commit/24b8619f33b784bbe5b853b465cbde350209b8e0))

# [0.27.0-rc.2](https://github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.1...v0.27.0-rc.2) (2026-01-22)

**Note:** Version bump only for package @sqlrooms/ai-rag

# [0.27.0-rc.1](https://github.com/sqlrooms/sqlrooms/compare/v0.27.0-rc.0...v0.27.0-rc.1) (2026-01-17)

**Note:** Version bump only for package @sqlrooms/ai-rag

# [0.27.0-rc.0](https://github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.13...v0.27.0-rc.0) (2025-12-27)

### Features

* SQLRooms CLI ([#263](https://github.com/sqlrooms/sqlrooms/issues/263)) ([d1937ff](https://github.com/sqlrooms/sqlrooms/commit/d1937ff6b42da12f0737051847d5b397fc97bfb5))

## [0.26.1-rc.13](https://github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.12...v0.26.1-rc.13) (2025-12-12)

**Note:** Version bump only for package @sqlrooms/ai-rag

## [0.26.1-rc.12](https://github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.11...v0.26.1-rc.12) (2025-12-11)

**Note:** Version bump only for package @sqlrooms/ai-rag

## [0.26.1-rc.11](https://github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.10...v0.26.1-rc.11) (2025-12-10)

**Note:** Version bump only for package @sqlrooms/ai-rag

## 0.26.1-rc.10 (2025-12-10)

**Note:** Version bump only for package @sqlrooms/ai-rag

## 0.26.1-rc.9 (2025-12-10)

**Note:** Version bump only for package @sqlrooms/ai-rag

## 0.26.1-rc.8 (2025-12-10)

### Bug Fixes

* SqlEditorSliceConfig openTabs migration ([#256](https://github.com/sqlrooms/sqlrooms/issues/256)) ([f213186](https://github.com/sqlrooms/sqlrooms/commit/f21318636d8151b942db6a15480731e86c00f5d4))

## 0.26.1-rc.7 (2025-12-05)

### Bug Fixes

* Incorrect import ([b194e35](https://github.com/sqlrooms/sqlrooms/commit/b194e35fbc7e99a900d81370d556b6fb1d4948aa))

## 0.26.1-rc.6 (2025-12-05)

### Bug Fixes

* Add missing dep @dnd-kit/modifiers ([78859e2](https://github.com/sqlrooms/sqlrooms/commit/78859e2b9ac0dad17209ac100d40e36f81da6c27))

## 0.26.1-rc.5 (2025-12-05)

**Note:** Version bump only for package @sqlrooms/ai-rag

## 0.26.1-rc.4 (2025-12-01)

### Bug Fixes

* Upgrade immer to prevent Object.freeze errors in kepler ([#218](https://github.com/sqlrooms/sqlrooms/issues/218)) ([1fe2250](https://github.com/sqlrooms/sqlrooms/commit/1fe2250ca2acf578c26931632baa229f4b8ce881))

## [0.26.1-rc.3](https://github.com/sqlrooms/sqlrooms/compare/v0.26.1-rc.2...v0.26.1-rc.3) (2025-12-01)

**Note:** Version bump only for package @sqlrooms/ai-rag

## 0.26.1-rc.2 (2025-12-01)

### Bug Fixes

* Kepler fixes to prevent example app from crashing ([#217](https://github.com/sqlrooms/sqlrooms/issues/217)) ([f57d9ff](https://github.com/sqlrooms/sqlrooms/commit/f57d9ff63a2356866ec99ba3fd9b203a8e35abb3))

## 0.26.1-rc.1 (2025-11-30)

**Note:** Version bump only for package @sqlrooms/ai-rag

## 0.26.1-rc.0 (2025-11-30)

**Note:** Version bump only for package @sqlrooms/ai-rag

# RAG Slice Changelog

## 2025-11-21 - Per-Database Embedding Providers

### Breaking Changes

- **Removed global `embeddingProvider`** from `createRagSlice()` options
- **Added per-database `embeddingProvider`** to `EmbeddingDatabase` config
- **Changed query behavior**: Now queries a single database at a time (not UNION across all)
- **Removed `setEmbeddingProvider()`** method (no longer needed)

### New Features

#### Per-Database Embedding Providers

Each database can now use its own embedding model:

```typescript
const embeddingsDatabases = [
  {
    databaseName: 'duckdb_docs',
    databaseFilePathOrUrl: '/data/duckdb.duckdb',
    embeddingProvider: createOpenAIProvider('text-embedding-3-small', 1536),
    embeddingDimensions: 1536,
  },
  {
    databaseName: 'react_docs',
    databaseFilePathOrUrl: '/data/react.duckdb',
    embeddingProvider: createTransformersJsProvider('BAAI/bge-small-en-v1.5'),
    embeddingDimensions: 384,
  },
];
```

#### Metadata Support

- Added `getMetadata(databaseName)` method
- Automatically fetches metadata from `embedding_metadata` table
- Validates embedding dimensions against metadata
- Displays model info during initialization

#### Improved Error Messages

- Clear dimension mismatch errors
- Database not found with suggestions
- Better validation feedback

### API Changes

#### Before (Old API)

```typescript
// Global embedding provider
createRagSlice({
  embeddingsDatabases: [
    {
      databaseFilePathOrUrl: '/data/docs.duckdb',
      databaseName: 'docs',
    },
  ],
  embeddingProvider, // One provider for all databases
});

// Searched across ALL databases with UNION
await store.getState().rag.queryByText('query', {
  databases: ['docs', 'tutorials'], // Multi-database search
});
```

#### After (New API)

```typescript
// Per-database embedding providers
createRagSlice({
  embeddingsDatabases: [
    {
      databaseFilePathOrUrl: '/data/docs.duckdb',
      databaseName: 'docs',
      embeddingProvider: createOpenAIProvider(...), // Each DB has its own
      embeddingDimensions: 1536,
    },
  ],
});

// Search one database at a time
await store.getState().rag.queryByText('query', {
  database: 'docs', // Single database (default: first one)
});
```

### Type Changes

#### Added Types

```typescript
type DatabaseMetadata = {
  provider: string;
  model: string;
  dimensions: number;
  chunkingStrategy: string;
};
```

#### Updated Types

```typescript
// EmbeddingDatabase now includes provider and dimensions
type EmbeddingDatabase = {
  databaseFilePathOrUrl: string;
  databaseName: string;
  embeddingProvider: EmbeddingProvider; // NEW: Required
  embeddingDimensions?: number; // NEW: Optional validation
};

// Query options changed from 'databases' to 'database'
queryByText(
  text: string,
  options?: {
    topK?: number;
    database?: string; // Changed from 'databases?: string[]'
  },
);
```

### Migration Guide

#### Step 1: Move embedding provider to database config

```typescript
// Before
createRagSlice({
  embeddingsDatabases: [{databaseName: 'docs', ...}],
  embeddingProvider,
});

// After
createRagSlice({
  embeddingsDatabases: [
    {
      databaseName: 'docs',
      embeddingProvider, // Move here
      embeddingDimensions: 1536, // Add for validation
      ...
    },
  ],
});
```

#### Step 2: Update query calls

```typescript
// Before
queryByText('query', {databases: ['docs', 'tutorials']});

// After - query one database
queryByText('query', {database: 'docs'});
```

#### Step 3: Remove setEmbeddingProvider() calls

```typescript
// Before
store.getState().rag.setEmbeddingProvider(newProvider);

// After - not needed, provider is set in config
// If you need to change providers, recreate the store
```

### Rationale

**Why per-database providers?**

Different datasets are often prepared with different embedding models:
- OpenAI models (text-embedding-3-small, ada-002)
- HuggingFace models (BGE, E5, etc.)
- Custom models
- Different dimensions (384, 512, 1536, 3072, etc.)

The old design with a single global provider couldn't handle this properly. The query embedding would be generated with one model, but the database might have been prepared with a different model, causing poor results.

**Why single-database queries?**

UNION queries across databases with different embedding models don't make sense - you can't meaningfully compare cosine similarities from different embedding spaces. Searching one database at a time ensures consistency.

If you need to search multiple databases, make separate queries:

```typescript
const [docsResults, tutResults] = await Promise.all([
  store.getState().rag.queryByText('query', {database: 'docs'}),
  store.getState().rag.queryByText('query', {database: 'tutorials'}),
]);
```

### Implementation Details

#### Initialization Flow

1. Attach each database with `ATTACH DATABASE ... AS ... (READ_ONLY)`
2. Store the embedding provider for each database in a Map
3. Query `embedding_metadata` table to get model info
4. Validate dimensions if provided
5. Store metadata in a Map for later access

#### Query Flow

1. Determine which database to query (from options or default to first)
2. Get the embedding provider for that database
3. Generate embedding from query text
4. Validate dimensions against metadata
5. Execute SQL query with cosine similarity
6. Return results sorted by similarity

### Files Changed

- `packages/rag/src/RagSlice.ts` - Main implementation
- `examples/ai/src/embeddings.ts` - NEW: OpenAI provider helpers
- `examples/ai/src/rag-example.ts` - NEW: Usage examples
- `packages/rag/README.md` - NEW: Comprehensive documentation

### Testing

All linter checks pass. Manual testing recommended for:
- [ ] Multiple databases with different models
- [ ] Metadata validation
- [ ] Dimension mismatch errors
- [ ] Database not found errors
- [ ] Query results quality

### Future Enhancements

Potential improvements for future versions:

1. **Hybrid Search**: Add BM25 full-text search with Reciprocal Rank Fusion
2. **Batch Queries**: Query multiple databases efficiently
3. **Caching**: Cache embeddings for repeated queries
4. **Streaming**: Stream results for long-running queries
5. **Filters**: Add metadata filtering to queries
6. **Reranking**: Add cross-encoder reranking for better results
