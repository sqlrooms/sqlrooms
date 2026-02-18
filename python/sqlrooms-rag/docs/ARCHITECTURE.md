# SQLRooms RAG Architecture

## Database Schema

The RAG system uses DuckDB with three main components:

### 1. `documents` Table (Chunks)
Created by llama-index's DuckDBVectorStore:
- `node_id` (VARCHAR) - Unique chunk identifier
- `text` (TEXT) - Chunk content
- `metadata_` (JSON) - File metadata (path, name, headers, etc.)
- `embedding` (FLOAT[384]) - Vector embedding
- `doc_id` (VARCHAR) - **NEW**: Reference to source document

### 2. `source_documents` Table (Full Documents)
Stores original documents before chunking:
- `doc_id` (VARCHAR PRIMARY KEY) - Document identifier
- `file_path` (VARCHAR) - Full file path
- `file_name` (VARCHAR) - File name
- `text` (TEXT) - Complete document text
- `metadata_` (JSON) - Document metadata
- `created_at` (TIMESTAMP) - Creation timestamp

### 3. FTS Tables (Full-Text Search)
Created by DuckDB FTS extension:
- `fts_main_documents` - FTS index on chunks
- `fts_main_documents_docs` - Document mappings
- `fts_main_documents_config` - FTS configuration

## Data Flow

```
Markdown Files
    ↓
1. Load with SimpleDirectoryReader
    ↓
2. Store in source_documents (full text)
    ↓
3. Parse into chunks with MarkdownNodeParser
    ↓
4. Generate embeddings for each chunk
    ↓
5. Store chunks in documents table
    ↓
6. Link chunks to source via doc_id
    ↓
7. Create FTS index on chunk text
    ↓
Ready for Hybrid Retrieval
```

## Preparation Pipeline

### `prepare_embeddings()`
1. **Validate inputs** - Check directory exists, contains .md files
2. **Load embedding model** - HuggingFace model (cached after first run)
3. **Load documents** - Read all .md files recursively
4. **Parse into chunks** - Markdown-aware or size-based
5. **Generate embeddings** - Create vector embeddings for each chunk
6. **Store in DuckDB** - Save embeddings and metadata
7. **Store source documents** - Save full original documents
8. **Link chunks to sources** - Add doc_id references
9. **Create FTS index** - Enable keyword search

All steps are automatic during `prepare_embeddings()` - no manual setup required.

## Query Pipeline

### Hybrid Query (Recommended)
```
User Query
    ↓
├─→ Generate Embedding ──→ Vector Search (cosine similarity)
│                                ↓
│                          Get top-N chunks
│
└─→ Tokenize ──→ FTS Search (BM25)
                      ↓
                Get top-N chunks
                      ↓
            Combine with RRF
                      ↓
              Return top-K results
                      ↓
      (Optional) Fetch source documents
```

### Vector-Only Query
```
User Query
    ↓
Generate Embedding
    ↓
Vector Search (cosine similarity)
    ↓
Return top-K chunks
```

## Retrieval Methods

### 1. Vector Similarity Search
- Uses `array_cosine_similarity()` in DuckDB
- Semantic/conceptual matching
- Good for natural language queries
- Embedding dimension: 384 (default)

### 2. Full-Text Search (FTS)
- Uses DuckDB FTS extension with BM25
- Keyword/exact term matching
- Good for technical terms, acronyms, code
- Porter stemmer + stopwords removal

### 3. Hybrid (RRF)
- Combines both methods
- Reciprocal Rank Fusion algorithm
- No score normalization needed
- Robust across query types

## Key Design Decisions

### Why Store Source Documents?
**Problem**: Chunks are great for finding relevant content, but you often need full document context for RAG.

**Solution**: 
- Store complete original documents in `source_documents`
- Link each chunk to its source via `doc_id`
- Easy retrieval: `get_source_documents(chunk_ids)`

**Use Cases**:
- Show full documentation page to LLM
- Display context around relevant snippets
- Trace back to original source files

### Why Create FTS During Preparation?
**Problem**: Users might forget to create FTS index, breaking hybrid search.

**Solution**:
- Automatically create FTS index during `prepare_embeddings()`
- Graceful failure if FTS extension unavailable
- One-time setup, no manual steps

**Benefits**:
- Better UX - works out of the box
- No separate setup commands
- Index always in sync with embeddings

### Why DuckDB?
**Advantages**:
- Embedded database (no server needed)
- Fast vector operations
- Native FTS support
- SQL interface
- Single file storage
- OLAP-optimized (great for analytics queries)

**Alternative considered**: SQLite + separate vector DB
- **Rejected**: More complex, two databases to manage

## Performance Characteristics

### Preparation
- **Time**: ~1-2 seconds per document
- **Memory**: 2-4GB during processing
- **Storage**: ~2-3x original markdown size
  - Embeddings: ~1.5KB per chunk (384 dim)
  - Source docs: ~1x original size
  - FTS index: ~0.2x text size

### Query
- **Vector search**: 50-100ms for 10K chunks
- **FTS search**: 10-30ms
- **Hybrid (parallel)**: 60-120ms
- **RRF fusion**: <1ms
- **Source doc retrieval**: 5-10ms per doc

### Scaling
- Tested up to: 100K chunks (~10GB markdown)
- Recommended: < 1M chunks
- For larger: Consider chunking strategy or sharding

## API Surface

### Core Functions

```python
# Preparation
prepare_embeddings(
    input_dir: str,
    output_db: str,
    chunk_size: int = 512,
    embed_model_name: str = "BAAI/bge-small-en-v1.5",
    ...
) -> VectorStoreIndex

# Querying
hybrid_query(
    query_text: str,
    db_path: str,
    top_k: int = 5,
    use_rrf: bool = True,
    include_source_docs: bool = False,
    ...
) -> List[Dict[str, Any]]

# Source document retrieval
get_source_documents(
    chunk_ids: List[str],
    db_path: str
) -> List[Dict[str, Any]]
```

### Result Schema

**Chunk Result**:
```python
{
    'node_id': str,           # Chunk identifier
    'text': str,              # Chunk content
    'metadata': dict,         # File metadata
    'score': float,           # Relevance score
    'score_type': str,        # 'rrf' or 'weighted'
    'source_doc': dict | None # Full document (if requested)
}
```

**Source Document**:
```python
{
    'doc_id': str,       # Document identifier
    'file_path': str,    # Full file path
    'file_name': str,    # File name
    'text': str,         # Complete document text
    'metadata': dict     # Document metadata
}
```

## Future Enhancements

### Considered for Next Version
1. **Reranking**: Cross-encoder model for final reranking
2. **Query expansion**: Use LLM to generate search variants
3. **Multi-field FTS**: Index metadata separately with weights
4. **Caching**: Cache embeddings for common queries
5. **Incremental updates**: Add/update documents without full rebuild
6. **Metadata filtering**: Pre-filter by source, date, tags before search
7. **Custom BM25 params**: Tune k1/b for specific corpus

### Not Planned
- ❌ Multi-language support (English-only for now)
- ❌ Real-time updates (batch processing model)
- ❌ Distributed/sharded setup (single machine focus)
- ❌ GPU acceleration (CPU embeddings sufficient)

## References

- [DuckDB Documentation](https://duckdb.org/docs/)
- [DuckDB FTS Extension](https://duckdb.org/docs/extensions/full_text_search.html)
- [Llama Index](https://docs.llamaindex.ai/)
- [BGE Embeddings](https://huggingface.co/BAAI/bge-small-en-v1.5)
- [Reciprocal Rank Fusion Paper](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
- [BM25 Algorithm](https://en.wikipedia.org/wiki/Okapi_BM25)

