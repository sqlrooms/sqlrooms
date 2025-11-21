# @sqlrooms/rag

Retrieval Augmented Generation (RAG) slice for SQLRooms. Query vector embeddings stored in DuckDB for semantic search and AI-powered applications.

## Features

- 🔍 **Semantic Search** - Query embeddings using vector similarity (cosine similarity)
- 🗄️ **Multiple Databases** - Attach and search across multiple embedding databases
- 🎯 **Per-Database Embedding Providers** - Each database can use a different embedding model
- ✅ **Metadata Validation** - Automatic validation of embedding dimensions and models
- 📊 **DuckDB-Powered** - Fast, in-process vector search with SQL
- 🔄 **Flexible** - Works with OpenAI, HuggingFace, Transformers.js, or custom embeddings

## Installation

```bash
npm install @sqlrooms/rag @sqlrooms/duckdb @sqlrooms/room-shell
```

## Quick Start

```typescript
import {createDuckDbSlice} from '@sqlrooms/duckdb';
import {createRagSlice, createAiEmbeddingProvider} from '@sqlrooms/rag';
import {createRoomStore} from '@sqlrooms/room-shell';
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

const results = await store.getState().rag.queryByText(
  'How do I create a table?',
  {topK: 5},
);

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

Query embeddings using text. The embedding provider for the specified database will be used to convert text to embeddings.

```typescript
const results = await store.getState().rag.queryByText('search query', {
  topK: 5, // Number of results to return (default: 5)
  database: 'docs', // Database to search (default: first database)
});
```

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
import {createAiEmbeddingProvider} from '@sqlrooms/rag';

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

## Embedding Providers

The `createAiEmbeddingProvider()` function works with any provider from the Vercel AI SDK.

### OpenAI

```typescript
import {openai} from '@ai-sdk/openai';
import {createAiEmbeddingProvider} from '@sqlrooms/rag';

const embeddingProvider = createAiEmbeddingProvider(
  openai,
  'text-embedding-3-small',
  1536,
);
```

### Google

```typescript
import {google} from '@ai-sdk/google';
import {createAiEmbeddingProvider} from '@sqlrooms/rag';

const embeddingProvider = createAiEmbeddingProvider(
  google,
  'text-embedding-004',
  768,
);
```

### Custom Provider

```typescript
import {createAiEmbeddingProvider} from '@sqlrooms/rag';

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
import {createAiEmbeddingProvider} from '@sqlrooms/rag';

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
