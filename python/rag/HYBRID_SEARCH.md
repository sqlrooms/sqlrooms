# Hybrid Search: Vector + Full-Text Retrieval

This implementation combines vector similarity search with full-text search (FTS) for improved RAG performance.

## Why Hybrid?

**Vector Search Strengths:**

- Semantic/conceptual matching
- Works across different phrasings
- Understands context and relationships

**Vector Search Weaknesses:**

- May miss exact term matches
- Struggles with acronyms, code snippets
- Can be "too semantic" for specific queries

**Full-Text Search Strengths:**

- Exact keyword matching (BM25 algorithm)
- Great for technical terms, function names, acronyms
- Fast and deterministic

**Full-Text Search Weaknesses:**

- No semantic understanding
- Requires exact or similar words
- Misses conceptual matches

## Architecture

```
Query Text
    |
    ├─→ Generate Embedding ──→ Vector Search (cosine similarity)
    |                                    |
    └─→ Parse Keywords    ──→ FTS Search (BM25)
                                         |
                                         ↓
                            Reciprocal Rank Fusion (RRF)
                                         |
                                         ↓
                                  Top-K Results
```

## Implementation Details

### 1. Automatic Setup

**FTS Index** is created automatically during `prepare_embeddings()`:

- No manual setup required
- Uses DuckDB's FTS extension
- Porter stemmer (normalizes word forms)
- English stopwords removal
- Case-insensitive matching
- Accent normalization

**Source Documents** are stored alongside chunks:

- Original full documents preserved in `source_documents` table
- Each chunk links to its source via `doc_id`
- Easy retrieval of full context after finding relevant chunks

### 2. Hybrid Query

```python
from sqlrooms_rag import hybrid_query, print_results

results = hybrid_query(
    "How do I use DuckDB arrays?",
    db_path="your_database.duckdb",
    top_k=5,
    use_rrf=True,  # Recommended
    verbose=True
)

print_results(results, "How do I use DuckDB arrays?")
```

### 3. Retrieving Full Source Documents

After finding relevant chunks, retrieve complete documents for full context:

```python
from sqlrooms_rag import get_source_documents

# Get source documents for top results
chunk_ids = [r['node_id'] for r in results[:3]]
source_docs = get_source_documents(chunk_ids, db_path)

for doc in source_docs:
    print(f"File: {doc['file_name']}")
    print(f"Full text: {doc['text']}")
```

Or include them directly in the query results:

```python
results = hybrid_query(
    query_text,
    include_source_docs=True,  # Fetch full documents
    verbose=True
)

for result in results:
    print(f"Chunk: {result['text'][:100]}...")
    if result.get('source_doc'):
        print(f"Full doc: {result['source_doc']['text']}")
```

This is useful for RAG where you want to:

- Show context around relevant snippets
- Include full documentation pages in LLM prompts
- Trace back to original source files

### 4. Reciprocal Rank Fusion (RRF)

RRF combines rankings without normalizing scores:

```
RRF_score(doc) = Σ (1 / (k + rank_i))
```

Where:

- `k` = 60 (standard constant from RRF paper)
- `rank_i` = position in each ranking system
- Sum across all systems (vector + FTS)

**Why RRF?**

- Robust: Works without score normalization
- Simple: No tuning of weights needed
- Effective: Proven in information retrieval research
- Fair: Balances both systems naturally

### 5. Alternative: Weighted Scores

```python
results = hybrid_query(
    query_text,
    use_rrf=False,
    vector_weight=0.7,  # 70% vector, 30% FTS
)
```

This normalizes scores (0-1) and combines them weighted. Less robust than RRF.

## When to Use Hybrid vs Vector-Only

**Use Hybrid when:**

- Queries contain specific technical terms
- Users search for function names, APIs, keywords
- Exact matching matters (code snippets, commands)
- Query combines concepts + specific terms

**Use Vector-Only when:**

- Queries are purely conceptual
- You want "fuzzy" semantic matching only
- FTS overhead isn't worth it (very small corpus)

**Examples:**

| Query                           | Best Method | Why                                                  |
| ------------------------------- | ----------- | ---------------------------------------------------- |
| "What is useState?"             | Hybrid      | "useState" is exact term FTS excels at               |
| "how to manage component state" | Vector-Only | Purely conceptual, semantic matching best            |
| "DuckDB ARRAY_AGG function"     | Hybrid      | Exact terms (DuckDB, ARRAY_AGG) + concept (function) |
| "differences between joins"     | Either      | Conceptual, but "joins" helps FTS                    |

## Performance

**Index Creation:**

- One-time cost after embedding preparation
- Fast: ~1-2 seconds for 1000 documents
- Storage: Minimal overhead (~10-20% of text size)

**Query Time:**

- Vector search: ~50-100ms for 10K documents
- FTS search: ~10-30ms
- Combined (parallel): ~60-120ms
- RRF fusion: <1ms

## DuckDB FTS vs Alternatives

**Why DuckDB FTS?**

- ✓ Already using DuckDB for vectors
- ✓ Single database for everything
- ✓ No external dependencies
- ✓ Native SQL integration
- ✓ BM25 scoring built-in
- ✓ Fast and well-optimized

**Alternatives:**

- Elasticsearch: Overkill for most cases, separate service
- Whoosh: Python-native but slower
- SQLite FTS5: Could work, but DuckDB is faster for analytics
- Tantivy: Fast but requires Rust dependencies

## Future Enhancements

Possible improvements to consider:

1. **Query Expansion**: Use LLM to expand query terms before search
2. **Reranking**: Add cross-encoder reranker after RRF
3. **Metadata Filtering**: Filter by source, date, etc. before fusion
4. **Custom BM25 Parameters**: Tune k1/b for your corpus
5. **Multi-field FTS**: Index metadata separately with different weights
6. **Caching**: Cache embeddings for common queries

## References

- [Reciprocal Rank Fusion Paper](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
- [DuckDB Full-Text Search](https://duckdb.org/docs/extensions/full_text_search.html)
- [BM25 Algorithm](https://en.wikipedia.org/wiki/Okapi_BM25)
