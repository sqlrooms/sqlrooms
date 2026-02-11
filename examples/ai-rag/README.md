### AI RAG Example (Retrieval Augmented Generation)

[Github repo](https://github.com/sqlrooms/examples/tree/main/ai-rag)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/ai-rag?embed=1&file=src/app.tsx)

<img src="/media/examples/rag.webp" alt="SQLRooms AI RAG example" width=450>

An example demonstrating Retrieval Augmented Generation (RAG) using SQLRooms and DuckDB for vector search. Features include:

- AI chat with RAG: ask questions and get answers based on relevant documentation
- Direct RAG search UI to query embedded documentation
- Vector embeddings stored in DuckDB with native vector similarity search
- Integration with OpenAI for embeddings and chat responses

To create a new project from the ai-rag example run this:

```bash
npx giget gh:sqlrooms/examples/ai-rag my-new-app/
```

#### Setup

##### 1. Generate DuckDB Documentation Embeddings

First, generate vector embeddings of the DuckDB documentation using the [sqlrooms-rag](https://pypi.org/project/sqlrooms-rag/) package:

```bash
# Download DuckDB docs
npx giget gh:duckdb/duckdb-web/docs ./duckdb-docs

# Generate embeddings with OpenAI (requires OPENAI_API_KEY env var)
OPENAI_API_KEY=your-key uvx --from sqlrooms-rag prepare-embeddings ./duckdb-docs -o public/rag/duckdb_docs.duckdb --provider openai
```

This will process all markdown files and create a DuckDB database with 1536-dim OpenAI embeddings at `public/rag/duckdb_docs.duckdb`.

##### 2. Set Your OpenAI API Key

The app requires an OpenAI API key for:

- Generating embeddings for your search queries (on the fly)
- Powering the AI chat responses

You'll be prompted to enter your API key when you start the app, or you can set it in the settings.

#### Running Locally

```bash
npm install
npm run dev
```

Then open the app and:

1. Enter your OpenAI API key in the settings
2. Click the search icon to test RAG search directly
3. Use the AI chat to ask questions about DuckDB
