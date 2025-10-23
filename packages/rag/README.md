# @sqlrooms/rag

RAG (Retrieval Augmented Generation) helper module for SQLRooms. This package provides a Zustand slice for querying vector embeddings stored in DuckDB databases.

## Features

- 🔍 **Vector Similarity Search** - Query embeddings using cosine similarity
- 📊 **Multiple Databases** - Search across multiple embedding databases simultaneously
- ⚡ **Efficient** - Uses DuckDB's native vector functions (`array_cosine_similarity`)
- 🔄 **Lazy Loading** - Databases are attached on-demand
- 📦 **Type-Safe** - Full TypeScript support

## Installation

```bash
npm install @sqlrooms/rag @sqlrooms/duckdb @sqlrooms/room-shell
```

## Usage

### 1. Create embeddings databases

First, prepare your embeddings using the Python tool:

```bash
pip install sqlrooms-rag

# Generate embeddings from markdown files
prepare-embeddings ./docs -o embeddings/docs.duckdb
```

See the [sqlrooms-rag Python package](../../python/rag) for details.

### 2. Add RAG slice to your store

```typescript
import {createRoomStore} from '@sqlrooms/room-shell';
import {createDuckDbSlice} from '@sqlrooms/duckdb';
import {createRagSlice} from '@sqlrooms/rag';

const store = createRoomStore({
  config: {
    name: 'my-rag-app',
  },
  slices: [
    createDuckDbSlice(),
    createRagSlice({
      embeddingsDatabases: [
        {
          databaseFilePath: '/embeddings/docs.duckdb',
          databaseName: 'docs_embeddings',
        },
        {
          databaseFilePath: '/embeddings/api.duckdb',
          databaseName: 'api_embeddings',
        },
      ],
    }),
  ],
});
```

### 3. Initialize and query embeddings

```typescript
// Initialize (attaches databases)
await store.getState().rag.initialize();

// Query with a pre-computed embedding vector
const queryEmbedding = [0.1, 0.2, 0.3, ...]; // 384-dimensional vector

const results = await store.getState().rag.queryEmbeddings(
  queryEmbedding,
  {
    topK: 5, // Return top 5 results
    databases: ['docs_embeddings'], // Optional: search specific databases
  }
);

// Process results
results.forEach(result => {
  console.log(`Score: ${result.score}`);
  console.log(`Text: ${result.text}`);
  console.log(`Source: ${result.metadata?.file_name}`);
});
```

### 4. Using with an embedding API

To generate embeddings from user queries, integrate with an API:

```typescript
async function searchDocs(query: string) {
  // 1. Generate embedding from query text
  const response = await fetch('/api/embeddings', {
    method: 'POST',
    body: JSON.stringify({text: query}),
  });
  const {embedding} = await response.json();

  // 2. Query the vector database
  const results = await store.getState().rag.queryEmbeddings(embedding, {
    topK: 10,
  });

  return results;
}

// Usage
const results = await searchDocs('How do I use DuckDB?');
```

## API Reference

### `createRagSlice(options)`

Creates a RAG slice for the room store.

**Options:**

- `embeddingsDatabases` - Array of embedding database configurations
  - `databaseFilePath` - Path to the .duckdb file
  - `databaseName` - Name to use when attaching the database

**Returns:** StateCreator for the RAG slice

### `RagSliceState`

The slice adds a `rag` object to the store with the following methods:

#### `initialize(): Promise<void>`

Attaches all configured embedding databases. Called automatically on first query if not called explicitly.

```typescript
await store.getState().rag.initialize();
```

#### `queryEmbeddings(queryEmbedding, options?): Promise<EmbeddingResult[]>`

Queries embeddings using vector similarity search.

**Parameters:**

- `queryEmbedding` - Array of numbers (embedding vector, e.g., 384 dimensions)
- `options` (optional)
  - `topK` - Number of results to return (default: 5)
  - `databases` - Array of database names to search (default: all attached databases)

**Returns:** Promise resolving to array of `EmbeddingResult`:

```typescript
type EmbeddingResult = {
  score: number; // Cosine similarity score (0-1)
  text: string; // The document text
  nodeId: string; // Unique identifier
  metadata?: {
    // Optional metadata
    file_name?: string;
    [key: string]: unknown;
  };
};
```

#### `listDatabases(): string[]`

Returns array of attached database names.

```typescript
const databases = store.getState().rag.listDatabases();
// => ['docs_embeddings', 'api_embeddings']
```

## Database Schema

The embeddings databases should have a `documents` table with the following schema:

```sql
CREATE TABLE documents (
  node_id VARCHAR,           -- Unique identifier
  text VARCHAR,              -- Document text
  embedding FLOAT[384],      -- Embedding vector (dimension depends on model)
  metadata_ JSON             -- Optional metadata (file_name, etc.)
);
```

This schema is automatically created by the `sqlrooms-rag` Python package.

## Integration Examples

### With OpenAI Embeddings

```typescript
import OpenAI from 'openai';

const openai = new OpenAI();

async function searchWithOpenAI(query: string) {
  // Generate embedding using OpenAI
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: query,
  });

  const embedding = response.data[0].embedding;

  // Search the vector database
  return await store.getState().rag.queryEmbeddings(embedding, {
    topK: 10,
  });
}
```

### With Transformers.js (Client-side)

```typescript
import {pipeline} from '@xenova/transformers';

// Initialize the embedding model (runs in browser!)
const embedder = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2',
);

async function searchClientSide(query: string) {
  // Generate embedding in the browser
  const output = await embedder(query, {
    pooling: 'mean',
    normalize: true,
  });
  const embedding = Array.from(output.data);

  // Search the vector database
  return await store.getState().rag.queryEmbeddings(embedding, {
    topK: 5,
  });
}
```

### With a Custom Embedding Service

```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://your-service.com/embed', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text}),
  });

  const {embedding} = await response.json();
  return embedding;
}

async function search(query: string) {
  const embedding = await generateEmbedding(query);
  return await store.getState().rag.queryEmbeddings(embedding);
}
```

## Performance Tips

1. **Batch queries** - Initialize once, query multiple times
2. **Limit topK** - Only retrieve as many results as you need
3. **Use specific databases** - Search only relevant databases when possible
4. **Pre-compute embeddings** - Generate embeddings server-side if possible

## Troubleshooting

### "No embedding databases available to search"

Make sure you've called `initialize()` or that your database configurations are correct.

### "array_cosine_similarity function not found"

Ensure you're using a version of DuckDB that supports vector functions (v0.9.0+).

### Embedding dimension mismatch

Ensure your query embeddings have the same dimensions as the stored embeddings. Common dimensions:

- `BAAI/bge-small-en-v1.5`: 384
- `text-embedding-ada-002`: 1536
- `all-MiniLM-L6-v2`: 384

## Related Packages

- [`@sqlrooms/duckdb`](../duckdb) - DuckDB integration for SQLRooms
- [`@sqlrooms/room-shell`](../room-shell) - Core room state management
- [`sqlrooms-rag` (Python)](../../python/rag) - Embedding preparation tool

## License

MIT
