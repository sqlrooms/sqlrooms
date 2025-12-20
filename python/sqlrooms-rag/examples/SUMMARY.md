# DuckDB Documentation Embeddings - Complete Setup Guide

This guide shows you how to download DuckDB documentation, prepare embeddings, and use them in your SQLRooms application.

## 🚀 Quick Start

### 1. Download and Prepare DuckDB Documentation

```bash
cd python/sqlrooms-rag
uv run python examples/prepare_duckdb_docs.py
```

This single command will:

- ✅ Download latest DuckDB docs from GitHub (~600+ markdown files)
- ✅ Generate vector embeddings using BAAI/bge-small-en-v1.5
- ✅ Store embeddings in DuckDB database (~10-20MB)
- ✅ Output: `generated-embeddings/duckdb_docs.duckdb`

**Takes:** 5-10 minutes on first run (downloads embedding model)

### 2. Use in Your SQLRooms App

```typescript
import {createRoomStore} from '@sqlrooms/room-store';
import {createDuckDbSlice} from '@sqlrooms/duckdb';
import {createRagSlice} from '@sqlrooms/ai-rag';

const store = createRoomStore({
  config: {name: 'duckdb-docs-search'},
  slices: [
    createDuckDbSlice(),
    createRagSlice({
      embeddingsDatabases: [
        {
          databaseFilePathOrUrl: './embeddings/duckdb_docs.duckdb',
          databaseName: 'duckdb_docs',
        },
      ],
    }),
  ],
});

// Initialize
await store.getState().db.initialize();
await store.getState().rag.initialize();

// Search the documentation
const embedding = await generateEmbedding('How do I use window functions?');
const results = await store.getState().rag.queryEmbeddings(embedding, {
  topK: 5,
});

console.log(results);
// [
//   { score: 0.85, text: "Window functions...", nodeId: "...", metadata: {...} },
//   { score: 0.82, text: "The OVER clause...", nodeId: "...", metadata: {...} },
//   ...
// ]
```

## 📋 What Gets Created

After running the preparation script:

```
python/sqlrooms-rag/
├── downloaded-docs/
│   └── duckdb/              # Downloaded DuckDB docs (~600 .md files)
│       ├── archive/
│       ├── configuration/
│       ├── data/
│       ├── extensions/
│       ├── sql/
│       └── ...
└── generated-embeddings/
    └── duckdb_docs.duckdb   # Vector embeddings database (~10-20MB)
```

**Database Schema:**

```sql
CREATE TABLE documents (
  node_id VARCHAR,           -- Unique chunk identifier
  text VARCHAR,              -- Document text (512 token chunks)
  embedding FLOAT[384],      -- Vector embedding (384 dimensions)
  metadata_ JSON             -- Source file, dates, etc.
);
```

## 🔧 Advanced Usage

### Custom Options

```bash
# Use different embedding model
uv run python examples/prepare_duckdb_docs.py \
  --model "sentence-transformers/all-MiniLM-L6-v2" \
  --embed-dim 384

# Custom output location
uv run python examples/prepare_duckdb_docs.py \
  --docs-dir ./my-docs \
  --output ./my-embeddings/duckdb.duckdb

# Smaller chunks for more granular search
uv run python examples/prepare_duckdb_docs.py \
  --chunk-size 256

# Clean up downloaded docs after processing
uv run python examples/prepare_duckdb_docs.py \
  --clean

# Use existing docs (skip download)
uv run python examples/prepare_duckdb_docs.py \
  --skip-download \
  --docs-dir ./downloaded-docs/duckdb
```

### Using the Bash Script

For a simpler interface:

```bash
# Make executable (first time only)
chmod +x examples/prepare_duckdb_docs.sh

# Run with defaults
./examples/prepare_duckdb_docs.sh

# Custom paths
./examples/prepare_duckdb_docs.sh ./my-docs ./my-embeddings/duckdb.duckdb
```

## 🔍 Querying the Documentation

### Option 1: Test Script (Recommended First)

```bash
# Run predefined test queries (interactive)
uv run python examples/query_duckdb_docs.py

# Or test with a specific question
uv run python examples/query_duckdb_docs.py "What is a window function?"
uv run python examples/query_duckdb_docs.py "How to connect to S3?"
uv run python examples/query_duckdb_docs.py "JSON functions in DuckDB"
```

**Output:**

```
🔍 Testing DuckDB Documentation Query
================================================================================
Database: generated-embeddings/duckdb_docs.duckdb
Query: What is a window function?
================================================================================

⏳ Loading embedding model...
⏳ Generating query embedding...
✓ Generated 384-dimensional embedding

⏳ Connecting to database...
✓ Connected to database
  - Total document chunks: 1842
  - Total source files: 612

⏳ Searching for top 5 most similar chunks...

📊 RESULTS
================================================================================

🔖 Result #1
   Score: 0.8542 (85.4%)
   Source: sql/window_functions/overview.md
   Text:
      Window functions perform calculations across a set of rows that are
      related to the current row. Unlike aggregate functions, window functions
      do not cause rows to become grouped into a single output row...
```

### Option 2: Direct Python Queries

```bash
# More advanced queries with exploration
uv run python examples/query_duckdb_direct.py "What is a window function?"
uv run python examples/query_duckdb_direct.py "How to connect to S3?"
```

**Output:**

```
Query: What is a window function?
================================================================================

Found 3 results:

1. Similarity Score: 0.8542
   Node ID: abc123...
   Source: sql/window_functions.md
   Text Preview:
   Window functions perform calculations across a set of rows that are related
   to the current row. Unlike aggregate functions, window functions do not
   cause rows to become grouped into a single output row...
```

### Option 3: Using llama-index

```bash
uv run python examples/example_query.py
```

This runs predefined queries using the llama-index high-level API.

## 🌐 Full RAG Integration

### With OpenAI

```typescript
import OpenAI from 'openai';

const openai = new OpenAI();

async function searchDocs(query: string) {
  // 1. Generate embedding
  const embeddingRes = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: query,
  });
  const embedding = embeddingRes.data[0].embedding;

  // 2. Search documentation
  const results = await store.getState().rag.queryEmbeddings(embedding, {
    topK: 3,
  });

  // 3. Build context
  const context = results.map((r) => r.text).join('\n\n');

  // 4. Get answer from LLM
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {role: 'system', content: 'Answer based on the DuckDB documentation.'},
      {role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}`},
    ],
  });

  return completion.choices[0].message.content;
}

// Usage
const answer = await searchDocs('How do I use window functions?');
console.log(answer);
```

### With Transformers.js (Client-side)

```typescript
import {pipeline} from '@xenova/transformers';

// Initialize once
const embedder = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2',
);

async function searchDocsClientSide(query: string) {
  // Generate embedding in browser
  const output = await embedder(query, {pooling: 'mean', normalize: true});
  const embedding = Array.from(output.data);

  // Search
  return await store.getState().rag.queryEmbeddings(embedding, {topK: 5});
}

// No server needed!
const results = await searchDocsClientSide('window functions');
```

## 📊 Example Use Cases

### 1. Documentation Search Widget

```typescript
function DocSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const search = async () => {
    const embedding = await generateEmbedding(query);
    const found = await store.getState().rag.queryEmbeddings(embedding);
    setResults(found);
  };

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <button onClick={search}>Search</button>
      {results.map(r => (
        <div key={r.nodeId}>
          <strong>Score: {r.score.toFixed(2)}</strong>
          <p>{r.text}</p>
          <small>Source: {r.metadata?.file_name}</small>
        </div>
      ))}
    </div>
  );
}
```

### 2. AI Assistant with Context

```typescript
async function askDuckDBQuestion(question: string) {
  // 1. Find relevant docs
  const embedding = await generateEmbedding(question);
  const context = await store
    .getState()
    .rag.queryEmbeddings(embedding, {topK: 3});

  // 2. Build prompt with context
  const contextText = context.map((c) => c.text).join('\n\n');

  // 3. Get AI answer
  return await callLLM({
    system:
      'You are a DuckDB expert. Answer based on the documentation provided.',
    user: `Documentation:\n${contextText}\n\nQuestion: ${question}`,
  });
}
```

### 3. Auto-complete Suggestions

```typescript
async function suggestQueries(partial: string) {
  const embedding = await generateEmbedding(partial);
  const results = await store
    .getState()
    .rag.queryEmbeddings(embedding, {topK: 5});

  // Extract common topics
  return results.map((r) => extractTopic(r.text));
}
```

## 📈 Performance

**Preparation:**

- First run: ~5-10 minutes (downloads model + processes docs)
- Subsequent runs: ~2-3 minutes (model cached)

**Query Speed:**

- Embedding generation: 50-200ms (depends on API/model)
- DuckDB search: <10ms for 1000s of chunks
- Total: ~60-210ms end-to-end

**Database Size:**

- DuckDB docs: ~600 files → ~10-20MB database
- SQLRooms docs: ~2000 files → ~6MB database

## 🔧 Troubleshooting

### "npx not found"

Install Node.js: https://nodejs.org/

### "ModuleNotFoundError: No module named 'sqlrooms_rag'"

```bash
cd python/sqlrooms-rag
uv sync
```

### Model download is slow

First run downloads ~100-500MB. It's cached after that. Be patient!

### Out of memory

Reduce chunk size:

```bash
uv run python examples/prepare_duckdb_docs.py --chunk-size 256
```

### Database not found in TypeScript

Check file paths are correct relative to your app:

```typescript
databaseFilePathOrUrl: '/absolute/path/to/duckdb_docs.duckdb',
// or
databaseFilePathOrUrl: './relative/path/to/duckdb_docs.duckdb',
```

## 📚 What You've Built

After completing this guide, you have:

✅ Downloaded official DuckDB documentation  
✅ Generated searchable vector embeddings  
✅ Created a DuckDB vector database  
✅ Integrated semantic search into SQLRooms  
✅ Can query docs with natural language  
✅ Ready for RAG/AI assistant integration

## 🎯 Next Steps

1. **Prepare more documentation sets** - React, Node.js, TypeScript, etc.
2. **Build a multi-docs search** - Search across all your documentation
3. **Add an LLM** - Full RAG with OpenAI/Anthropic/local models
4. **Deploy** - Host embeddings alongside your app
5. **Customize** - Try different models, chunk sizes, etc.

## 📖 Related Documentation

- [Python Package README](../README.md)
- [Examples README](./README.md)
- [TypeScript @sqlrooms/ai-rag Package](../../../packages/rag/README.md)
- [Full RAG Examples](../../../packages/rag/EXAMPLE.md)
- [SQL Query Reference](../QUERYING.md)

---

Happy searching! 🔍✨
