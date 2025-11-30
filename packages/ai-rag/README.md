Retrieval Augmented Generation (RAG) slice for SQLRooms. Query vector embeddings stored in DuckDB for semantic search and AI-powered applications.

This package is designed to work with [sqlrooms-rag](https://pypi.org/project/sqlrooms-rag/), a Python package that prepares embedding/FTS-index databases for RAG search.

Refer to the [ai-rag example](https://github.com/sqlrooms/examples/tree/main/ai-rag) for a complete working example.

## Features

- 🔍 **Hybrid Search** - Combines vector similarity with full-text search (BM25) using Reciprocal Rank Fusion
- 🚀 **Semantic Search** - Query embeddings using vector similarity (cosine similarity)
- 🗄️ **Multiple Databases** - Attach and search across multiple embedding databases
- 🎯 **Per-Database Embedding Providers** - Each database can use a different embedding model
- ✅ **Metadata Validation** - Automatic validation of embedding dimensions and models
- 📊 **DuckDB-Powered** - Fast, in-process vector search with SQL and FTS
- 🔄 **Flexible** - Works with OpenAI, HuggingFace, Transformers.js, or custom embeddings

## Installation

```bash
npm install @sqlrooms/ai-rag @sqlrooms/duckdb @sqlrooms/room-store
```

## Quick Start

```typescript
import {createDuckDbSlice} from '@sqlrooms/duckdb';
import {createRagSlice, createAiEmbeddingProvider} from '@sqlrooms/ai-rag';
import {createRoomStore} from '@sqlrooms/room-store';
import {openai} from '@ai-sdk/openai';

// 1. Create an embedding provider (matches your database preparation)
const embeddingProvider = createAiEmbeddingProvider(
  openai,
  'text-embedding-3-small',
  1536,
);

// 2. Configure your embedding databases
const embeddingsDatabases = [
  {
    databaseFilePathOrUrl: '/path/to/docs.duckdb',
    databaseName: 'docs',
    embeddingProvider,
    embeddingDimensions: 1536,
  },
];

// 3. Create the store with RAG capabilities
const store = createRoomStore({
  slices: [
    createDuckDbSlice({databasePath: ':memory:'}),
    createRagSlice({embeddingsDatabases}),
  ],
});

// 4. Initialize and query
await store.getState().rag.initialize();

const results = await store
  .getState()
  .rag.queryByText('How do I create a table?', {topK: 5});

console.log(results);
```

## API Reference

### `createRagSlice(options)`

Creates a RAG slice for your store.

#### Options

- `embeddingsDatabases` - Array of embedding database configurations

#### Returns

A state creator function for Zustand.

### `EmbeddingDatabase`

Configuration for an embedding database:

```typescript
type EmbeddingDatabase = {
  /** Path or URL to the DuckDB embedding database file */
  databaseFilePathOrUrl: string;

  /** Name to use when attaching the database */
  databaseName: string;

  /**
   * Embedding provider for this database.
   * MUST match the model used during database preparation.
   */
  embeddingProvider: EmbeddingProvider;

  /**
   * Expected embedding dimensions (for validation).
   * Optional but recommended.
   */
  embeddingDimensions?: number;
};
```

### `EmbeddingProvider`

Function that converts text to embeddings:

```typescript
type EmbeddingProvider = (text: string) => Promise<number[]>;
```

**Important**: The embedding provider MUST match the model used when preparing the database. Check your database metadata to ensure compatibility.

### Store Methods

#### `rag.initialize()`

Initialize RAG by attaching all embedding databases and validating metadata.

```typescript
await store.getState().rag.initialize();
```

#### `rag.queryByText(text, options)`

Query embeddings using text. By default, performs **hybrid search** combining vector similarity with full-text search (BM25) using Reciprocal Rank Fusion (RRF).

```typescript
const results = await store.getState().rag.queryByText('search query', {
  topK: 5, // Number of results to return (default: 5)
  database: 'docs', // Database to search (default: first database)
  hybrid: true, // Enable hybrid search (default: true)
  // hybrid: false, // Disable hybrid search (vector-only)
  // hybrid: 60, // Custom RRF k value (default: 60)
});
```

**Hybrid Search** combines:

- **Vector similarity**: Semantic understanding of the query
- **Full-text search (BM25)**: Keyword matching and ranking
- **Reciprocal Rank Fusion**: Smart combination of both result sets

This approach typically provides better results than vector-only search, especially for queries with specific keywords or technical terms.

Returns:

```typescript
type EmbeddingResult = {
  score: number; // Cosine similarity (0-1, higher is better)
  text: string; // The matched text chunk
  nodeId: string; // Unique identifier for the chunk
  metadata?: Record<string, unknown>; // Optional metadata (file path, etc.)
};
```

#### `rag.queryEmbeddings(embedding, options)`

Query embeddings using a pre-computed embedding vector.

```typescript
const embedding = await embeddingProvider('search query');
const results = await store.getState().rag.queryEmbeddings(embedding, {
  topK: 5,
  database: 'docs',
});
```

#### `rag.getMetadata(databaseName)`

Get metadata for a specific database:

```typescript
const metadata = await store.getState().rag.getMetadata('docs');
console.log(metadata);
// {
//   provider: 'openai',
//   model: 'text-embedding-3-small',
//   dimensions: 1536,
//   chunkingStrategy: 'markdown-aware'
// }
```

#### `rag.listDatabases()`

List all attached embedding databases:

```typescript
const databases = store.getState().rag.listDatabases();
console.log(databases); // ['docs', 'tutorials', 'api']
```

## Multiple Databases

You can attach multiple embedding databases, each with its own embedding model:

```typescript
import {openai} from '@ai-sdk/openai';
import {google} from '@ai-sdk/google';
import {createAiEmbeddingProvider} from '@sqlrooms/ai-rag';

const embeddingsDatabases = [
  {
    databaseFilePathOrUrl: '/data/duckdb_docs.duckdb',
    databaseName: 'duckdb_docs',
    // OpenAI text-embedding-3-small (1536d)
    embeddingProvider: createAiEmbeddingProvider(
      openai,
      'text-embedding-3-small',
      1536,
    ),
    embeddingDimensions: 1536,
  },
  {
    databaseFilePathOrUrl: '/data/react_docs.duckdb',
    databaseName: 'react_docs',
    // OpenAI text-embedding-3-small with reduced dimensions (512d)
    embeddingProvider: createAiEmbeddingProvider(
      openai,
      'text-embedding-3-small',
      512,
    ),
    embeddingDimensions: 512,
  },
  {
    databaseFilePathOrUrl: '/data/python_docs.duckdb',
    databaseName: 'python_docs',
    // Google text-embedding-004 (768d)
    embeddingProvider: createAiEmbeddingProvider(
      google,
      'text-embedding-004',
      768,
    ),
    embeddingDimensions: 768,
  },
];
```

Query a specific database:

```typescript
// Query DuckDB docs
const duckdbResults = await store
  .getState()
  .rag.queryByText('How to create a table?', {
    database: 'duckdb_docs',
  });

// Query React docs
const reactResults = await store
  .getState()
  .rag.queryByText('How to use hooks?', {
    database: 'react_docs',
  });
```

## Hybrid Search

Hybrid search combines vector similarity (semantic understanding) with full-text search (keyword matching) to provide more accurate and comprehensive results.

### How It Works

1. **Vector Search**: Uses embedding similarity to find semantically related content
2. **Full-Text Search (BM25)**: Uses DuckDB's FTS extension for keyword-based ranking
3. **Reciprocal Rank Fusion (RRF)**: Intelligently combines both result sets

### Benefits

- **Better Recall**: Finds results even when exact keywords aren't in the query
- **Improved Precision**: Keyword matching helps rank exact matches higher
- **Balanced Results**: RRF prevents either method from dominating unfairly

### Configuration

```typescript
// Default: Hybrid search enabled with k=60
const results = await store.getState().rag.queryByText('query', {
  hybrid: true, // Enable hybrid search (default)
});

// Pure vector search only
const vectorOnly = await store.getState().rag.queryByText('query', {
  hybrid: false, // Disable hybrid search
});

// Custom RRF k value (lower = more weight to top-ranked results)
const customRRF = await store.getState().rag.queryByText('query', {
  hybrid: 60, // Custom k value for Reciprocal Rank Fusion
});
```

### When to Use What

- **Hybrid (default)**: Best for most use cases, especially technical documentation
- **Vector-only**: When you want pure semantic matching without keyword bias
- **Lower k value** (e.g., 30): Give more weight to top-ranked results
- **Higher k value** (e.g., 100): More balanced combination, less bias to top results

### Requirements

Hybrid search requires that the embedding database was prepared with FTS indexing enabled (which is the default in the Python `prepare-embeddings` command). If FTS is not available, the system automatically falls back to vector-only search.

## Embedding Providers

The `createAiEmbeddingProvider()` function works with any provider from the Vercel AI SDK.

### OpenAI

```typescript
import {openai} from '@ai-sdk/openai';
import {createAiEmbeddingProvider} from '@sqlrooms/ai-rag';

const embeddingProvider = createAiEmbeddingProvider(
  openai,
  'text-embedding-3-small',
  1536,
);
```

### Google

```typescript
import {google} from '@ai-sdk/google';
import {createAiEmbeddingProvider} from '@sqlrooms/ai-rag';

const embeddingProvider = createAiEmbeddingProvider(
  google,
  'text-embedding-004',
  768,
);
```

### Custom Provider

```typescript
import {createAiEmbeddingProvider} from '@sqlrooms/ai-rag';

// Any provider that implements the AiProvider interface
const embeddingProvider = createAiEmbeddingProvider(
  myCustomProvider,
  'my-model-id',
  512,
);
```

### Multiple Providers Example

You can use different providers for different databases:

```typescript
import {openai} from '@ai-sdk/openai';
import {google} from '@ai-sdk/google';
import {createAiEmbeddingProvider} from '@sqlrooms/ai-rag';

const embeddingsDatabases = [
  {
    databaseName: 'docs_openai',
    databaseFilePathOrUrl: './embeddings/docs_openai.duckdb',
    embeddingProvider: createAiEmbeddingProvider(
      openai,
      'text-embedding-3-small',
      1536,
    ),
    embeddingDimensions: 1536,
  },
  {
    databaseName: 'docs_google',
    databaseFilePathOrUrl: './embeddings/docs_google.duckdb',
    embeddingProvider: createAiEmbeddingProvider(
      google,
      'text-embedding-004',
      768,
    ),
    embeddingDimensions: 768,
  },
];
```

## Preparing Databases

Use the Python `sqlrooms_rag` package to prepare embedding databases:

```bash
# Install the package
pip install sqlrooms-rag

# Prepare embeddings with OpenAI
python -m sqlrooms_rag.cli prepare-embeddings \
  docs/ \
  -o embeddings.duckdb \
  --provider openai \
  --model text-embedding-3-small \
  --embed-dim 1536

# Prepare embeddings with HuggingFace (local, free)
python -m sqlrooms_rag.cli prepare-embeddings \
  docs/ \
  -o embeddings.duckdb \
  --provider huggingface \
  --model BAAI/bge-small-en-v1.5
```

See the [Python package documentation](../../python/rag/README.md) for more details.

## Database Schema

The embedding databases created by `sqlrooms_rag` have the following structure:

```sql
-- Main documents table with embeddings
CREATE TABLE documents (
  node_id VARCHAR PRIMARY KEY,
  text TEXT,
  metadata_ JSON,
  embedding FLOAT[],  -- Vector embedding
  doc_id VARCHAR      -- Link to source document
);

-- Original source documents (full, unchunked)
CREATE TABLE source_documents (
  doc_id VARCHAR PRIMARY KEY,
  file_path VARCHAR,
  file_name VARCHAR,
  text TEXT,
  metadata_ JSON,
  created_at TIMESTAMP
);

-- Metadata about the embedding process
CREATE TABLE embedding_metadata (
  key VARCHAR PRIMARY KEY,
  value VARCHAR,
  created_at TIMESTAMP
);
```

## Error Handling

```typescript
try {
  const results = await store.getState().rag.queryByText('search query', {
    database: 'nonexistent',
  });
} catch (error) {
  // Error: Database "nonexistent" not found. Available: docs, tutorials
}

try {
  const wrongDimEmbedding = new Array(384).fill(0);
  await store.getState().rag.queryEmbeddings(wrongDimEmbedding, {
    database: 'docs', // Expects 1536 dimensions
  });
} catch (error) {
  // Error: Dimension mismatch: query has 384 dimensions,
  //        but database "docs" expects 1536 dimensions
}
```

## Best Practices

1. **Match Embedding Models**: Always use the same embedding model and dimensions when querying as when preparing the database.

2. **Check Metadata**: Use `getMetadata()` to verify the model and dimensions before querying.

3. **Dimension Validation**: Provide `embeddingDimensions` in your database configuration for automatic validation.

4. **Database Naming**: Use descriptive database names (e.g., `duckdb_docs`, `react_docs`) to easily identify them.

5. **Error Handling**: Always wrap queries in try-catch blocks to handle dimension mismatches and missing databases.

6. **Performance**: For large databases, consider using reduced dimensions (e.g., 512 instead of 1536) for faster queries and lower costs.

## Examples

See the [examples/ai](../../examples/ai) directory for complete examples:

- `src/embeddings.ts` - OpenAI embedding provider implementations
- `src/rag-example.ts` - Comprehensive usage examples
- `src/store.ts` - Store configuration with RAG

## License

MIT
