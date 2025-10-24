# SQLRooms RAG Examples

This directory contains example scripts for working with the sqlrooms-rag package.

## Scripts

### 1. `prepare_duckdb_docs.py` - Download and Prepare DuckDB Documentation

Downloads the official DuckDB documentation from GitHub and prepares embeddings.

**Basic Usage:**

```bash
uv run python prepare_duckdb_docs.py
```

**Options:**

```bash
uv run python prepare_duckdb_docs.py --help

Options:
  --docs-dir DIR          Directory to download docs (default: ./downloaded-docs/duckdb)
  --version VERSION       DuckDB docs version (default: stable)
  --skip-download         Skip download, use existing docs
  -o, --output FILE       Output database file (default: ./generated-embeddings/duckdb_docs.duckdb)
  --chunk-size SIZE       Chunk size in tokens (default: 512)
  --model MODEL           Embedding model (default: BAAI/bge-small-en-v1.5)
  --embed-dim DIM         Embedding dimensions (default: 384)
  --clean                 Remove downloaded docs after processing
```

**Examples:**

```bash
# Download and prepare with defaults
uv run python prepare_duckdb_docs.py

# Custom output location
uv run python prepare_duckdb_docs.py -o ./my-embeddings/duckdb.duckdb

# Use existing docs (skip download)
uv run python prepare_duckdb_docs.py --skip-download --docs-dir ./my-docs

# Clean up docs after processing
uv run python prepare_duckdb_docs.py --clean

# Use different model
uv run python prepare_duckdb_docs.py \
  --model "sentence-transformers/all-MiniLM-L6-v2" \
  --embed-dim 384
```

### 2. `prepare_duckdb_docs.sh` - Bash Version

Simplified bash script for preparing DuckDB documentation.

**Usage:**

```bash
# Make executable (first time only)
chmod +x prepare_duckdb_docs.sh

# Run with defaults
./prepare_duckdb_docs.sh

# Specify docs directory and output
./prepare_duckdb_docs.sh ./my-docs ./my-embeddings/duckdb.duckdb
```

**Requirements:**

- Node.js (for `npx degit`)
- `uv` and sqlrooms-rag package

### 3. `example_query.py` - Query Using llama-index

Demonstrates querying the knowledge base using llama-index's high-level API.

**Usage:**

```bash
# Query the generated embeddings
uv run python example_query.py
```

**What it does:**

- Loads the embeddings database
- Runs predefined example queries
- Shows similarity scores and retrieved text
- Displays source metadata

**Features:**

- Uses llama-index VectorStoreIndex
- Loads embedding model (BAAI/bge-small-en-v1.5)
- Retrieves top-3 most similar chunks
- Easy to modify for custom queries

### 4. `test_duckdb_docs_query.py` - Test DuckDB Docs Queries

Tests querying the prepared DuckDB documentation embeddings.

**Basic Usage:**

```bash
# Run predefined test queries
uv run python test_duckdb_docs_query.py

# Query with a specific question
uv run python test_duckdb_docs_query.py "What is a window function?"

# Get more results
uv run python test_duckdb_docs_query.py --top-k 10 "How to use JSON?"
```

**What it does:**

- Verifies the embeddings database exists
- Shows database statistics
- Tests queries with formatted output
- Runs predefined test queries interactively

**Perfect for:**

- Testing your embeddings after preparation
- Verifying query results
- Learning how to query the documentation

### 5. `query_duckdb_direct.py` - Direct DuckDB Queries

Queries the embeddings database directly using DuckDB SQL, without llama-index.

**Basic Usage:**

```bash
# Explore database and run batch queries
uv run python query_duckdb_direct.py

# Query with a specific question
uv run python query_duckdb_direct.py "How do I use window functions?"
```

**What it does:**

- Shows database schema and statistics
- Generates embeddings using sentence-transformers
- Runs SQL queries with `array_cosine_similarity()`
- Returns results sorted by similarity

**Functions:**

- `explore_database()` - Show schema and stats
- `query_embeddings_db()` - Single query with embedding
- `batch_query()` - Multiple queries efficiently

### 6. `generate_umap_example.py` - Programmatic UMAP Generation

Example of using the sqlrooms-rag API to generate UMAP embeddings programmatically.

**Basic Usage:**

```bash
uv run python generate_umap_example.py
```

**What it does:**

- Demonstrates programmatic API usage
- Loads embeddings using `load_embeddings_from_duckdb()`
- Processes with `process_embeddings()`
- Saves using `save_to_parquet()`

**Perfect for:**

- Integrating UMAP into your own scripts
- Customizing the UMAP workflow
- Batch processing multiple databases

**Note:** For CLI usage, use `uv run generate-umap-embeddings` instead.

## Quick Start

### 1. Prepare DuckDB Documentation

```bash
# Download and prepare embeddings
uv run python prepare_duckdb_docs.py
```

This creates `generated-embeddings/duckdb_docs.duckdb` (~10-20MB).

### 2. Test the Embeddings

```bash
# Run interactive test queries
uv run python test_duckdb_docs_query.py

# Or ask a specific question
uv run python test_duckdb_docs_query.py "What is a window function?"
```

### 3. Query the Documentation

**Quick test (recommended first):**

```bash
uv run python test_duckdb_docs_query.py "How do I use JSON functions?"
```

**Using llama-index:**

```bash
uv run python example_query.py
```

**Using DuckDB directly:**

```bash
uv run python query_duckdb_direct.py "What is a window function?"
uv run python query_duckdb_direct.py "How to connect to S3?"
```

## Using in Your Application

After preparing the embeddings, use them in your SQLRooms app:

```typescript
import {createRoomStore} from '@sqlrooms/room-shell';
import {createDuckDbSlice} from '@sqlrooms/duckdb';
import {createRagSlice} from '@sqlrooms/rag';

const store = createRoomStore({
  config: {name: 'my-app'},
  slices: [
    createDuckDbSlice(),
    createRagSlice({
      embeddingsDatabases: [
        {
          databaseFilePath: '/path/to/duckdb_docs.duckdb',
          databaseName: 'duckdb_docs',
        },
      ],
    }),
  ],
});

// Initialize
await store.getState().db.initialize();
await store.getState().rag.initialize();

// Query (you need to provide the embedding vector)
const embedding = await generateEmbedding('How do I use DuckDB?');
const results = await store.getState().rag.queryEmbeddings(embedding, {
  topK: 5,
});
```

## Preparing Other Documentation

You can use the same approach for any documentation:

### GitHub Repository

```bash
# Example: Prepare React docs
npx degit facebook/react/docs ./react-docs
uv run prepare-embeddings ./react-docs -o ./embeddings/react.duckdb
```

### Local Documentation

```bash
# Process any local markdown files
uv run prepare-embeddings /path/to/docs -o ./embeddings/my_docs.duckdb
```

### Multiple Documentation Sets

```bash
# Prepare multiple doc sets
uv run python prepare_duckdb_docs.py -o ./embeddings/duckdb.duckdb

npx degit nodejs/node/doc ./node-docs
uv run prepare-embeddings ./node-docs -o ./embeddings/node.duckdb

npx degit microsoft/TypeScript/docs ./ts-docs
uv run prepare-embeddings ./ts-docs -o ./embeddings/typescript.duckdb
```

Then query them all:

```typescript
createRagSlice({
  embeddingsDatabases: [
    {databaseFilePath: './embeddings/duckdb.duckdb', databaseName: 'duckdb'},
    {databaseFilePath: './embeddings/node.duckdb', databaseName: 'nodejs'},
    {databaseFilePath: './embeddings/typescript.duckdb', databaseName: 'ts'},
  ],
});
```

## Troubleshooting

### "npx not found"

Install Node.js from https://nodejs.org/

### "sqlrooms-rag not installed"

```bash
cd python/rag
uv sync
```

### "Database file not found"

Make sure you've run the preparation script first:

```bash
uv run python prepare_duckdb_docs.py
```

### Slow embedding generation

First run downloads the embedding model (~100-500MB) and caches it locally. Subsequent runs are much faster.

### Out of memory

Try reducing chunk size or processing fewer files at once:

```bash
uv run python prepare_duckdb_docs.py --chunk-size 256
```

## Related Documentation

- [Main README](../README.md) - Package documentation
- [QUERYING.md](../QUERYING.md) - SQL query reference
- [PUBLISHING.md](../PUBLISHING.md) - Publishing guide
- [@sqlrooms/rag Package](../../../packages/rag/README.md) - TypeScript package
