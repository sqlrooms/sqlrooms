# SQLRooms AI RAG Example

This example demonstrates **Retrieval Augmented Generation (RAG)** using SQLRooms and DuckDB for vector search.

## What This Example Showcases

This app lets you search and chat with DuckDB documentation using semantic search:

- **AI Chat with RAG**: Ask questions about DuckDB, and the AI assistant searches relevant documentation chunks and generates answers based on that context
- **Direct RAG Search UI**: A search interface to query the embedded documentation directly and view matching chunks
- **Vector Embeddings in DuckDB**: Pre-generated embeddings of DuckDB docs stored in a DuckDB database using DuckDB's native vector similarity search

## Setup

### 1. Generate DuckDB Documentation Embeddings

First, generate vector embeddings of the DuckDB documentation using the [sqlrooms-rag](https://pypi.org/project/sqlrooms-rag/) package:

```bash
# Download DuckDB docs
npx degit duckdb/duckdb-web/docs ./duckdb-docs

# Generate embeddings with OpenAI (requires OPENAI_API_KEY env var)
OPENAI_API_KEY=your-key uvx --from sqlrooms-rag prepare-embeddings ./duckdb-docs -o public/rag/duckdb_docs.duckdb --provider openai
```

This will process all markdown files and create a DuckDB database with 1536-dim OpenAI embeddings at `public/rag/duckdb_docs.duckdb`.

### 2. Set Your OpenAI API Key

The app requires an OpenAI API key for:

- Generating embeddings for your search queries (on the fly)
- Powering the AI chat responses

You'll be prompted to enter your API key when you start the app, or you can set it in the settings.

## Running Locally

```bash
npm install
npm run dev
```

Then open the app and:

1. Enter your OpenAI API key in the settings
2. Click the search icon to test RAG search directly
3. Use the AI chat to ask questions about DuckDB

[More about this example](https://sqlrooms.github.io/examples/)
