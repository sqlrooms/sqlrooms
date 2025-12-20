# Querying the Embeddings Database Directly

The generated DuckDB database can be queried directly without llama-index. This is useful for integration with other tools or custom applications.

## Database Schema

The database contains a single table called `documents`:

```sql
CREATE TABLE documents (
    node_id VARCHAR,           -- Unique identifier for the document chunk
    text VARCHAR,              -- The actual text content
    embedding FLOAT[384],      -- Vector embedding (384 dimensions for bge-small-en-v1.5)
    metadata_ JSON             -- Metadata (file_name, etc.)
);
```

## Basic Queries

### Explore the Database

```sql
-- Show all tables
SHOW TABLES;

-- View table schema
DESCRIBE documents;

-- Count total documents
SELECT COUNT(*) as total_documents FROM documents;

-- Get database statistics
SELECT 
    COUNT(*) as total_documents,
    AVG(length(text)) as avg_text_length,
    MIN(length(text)) as min_text_length,
    MAX(length(text)) as max_text_length
FROM documents;

-- View a sample document
SELECT text, metadata_ FROM documents LIMIT 1;

-- List all unique source files
SELECT DISTINCT metadata_->>'$.file_name' as file_name 
FROM documents 
WHERE metadata_ IS NOT NULL
ORDER BY file_name;

-- Count documents per source file
SELECT 
    metadata_->>'$.file_name' as file_name,
    COUNT(*) as chunk_count
FROM documents 
WHERE metadata_ IS NOT NULL
GROUP BY metadata_->>'$.file_name'
ORDER BY chunk_count DESC;
```

## Vector Similarity Search

### Using Python to Generate Query Embeddings

To search by semantic similarity, you need to generate an embedding for your query first:

```python
from sentence_transformers import SentenceTransformer
import duckdb

# Load the same model used to create the database
model = SentenceTransformer("BAAI/bge-small-en-v1.5")

# Generate embedding for your query
query_text = "What is SQLRooms?"
query_embedding = model.encode(query_text).tolist()

# Connect and search
conn = duckdb.connect("sqlrooms_docs", read_only=True)

# Find top 5 most similar documents using cosine similarity
results = conn.execute("""
    SELECT 
        text,
        metadata_->>'$.file_name' as source_file,
        array_cosine_similarity(embedding, ?::FLOAT[384]) as similarity
    FROM documents
    ORDER BY similarity DESC
    LIMIT 5
""", [query_embedding]).fetchall()

for text, source, similarity in results:
    print(f"[{similarity:.4f}] {source}: {text[:100]}...")

conn.close()
```

### Using the Direct Query Script

Run the included Python script:

```bash
# Explore database structure and stats
uv run python query_duckdb_direct.py

# Query with a specific question
uv run python query_duckdb_direct.py "How do I use DuckDB?"
```

## DuckDB Vector Functions

DuckDB provides several vector similarity functions:

### Cosine Similarity
```sql
SELECT array_cosine_similarity(embedding, ?::FLOAT[384]) as similarity
FROM documents;
```

### Euclidean Distance (L2)
```sql
SELECT array_distance(embedding, ?::FLOAT[384]) as distance
FROM documents
ORDER BY distance ASC;  -- Note: ascending order for distance
```

### Dot Product
```sql
SELECT array_inner_product(embedding, ?::FLOAT[384]) as score
FROM documents;
```

## Full-Text Search (Without Embeddings)

You can also do traditional text search:

```sql
-- Simple text search
SELECT text, metadata_
FROM documents
WHERE text LIKE '%SQLRooms%'
LIMIT 10;

-- Case-insensitive search
SELECT text, metadata_
FROM documents
WHERE LOWER(text) LIKE '%sqlrooms%'
LIMIT 10;

-- Search in specific files
SELECT text
FROM documents
WHERE metadata_->>'$.file_name' = 'getting-started.md'
  AND text LIKE '%DuckDB%';

-- Full-text search using regex
SELECT text, metadata_
FROM documents
WHERE regexp_matches(text, 'visualization|chart|graph', 'i')
LIMIT 10;
```

## Hybrid Search (Combining Vector + Text)

You can combine semantic search with text filters:

```python
# Search semantically but only in specific files
results = conn.execute("""
    SELECT 
        text,
        metadata_->>'$.file_name' as source,
        array_cosine_similarity(embedding, ?::FLOAT[384]) as similarity
    FROM documents
    WHERE metadata_->>'$.file_name' IN ('overview.md', 'getting-started.md')
    ORDER BY similarity DESC
    LIMIT 5
""", [query_embedding]).fetchall()
```

## Exporting Results

### Export to JSON

```sql
COPY (
    SELECT node_id, text, metadata_
    FROM documents
    WHERE metadata_->>'$.file_name' = 'overview.md'
) TO 'overview_chunks.json';
```

### Export to CSV

```sql
COPY (
    SELECT 
        node_id,
        text,
        metadata_->>'$.file_name' as source_file
    FROM documents
) TO 'all_documents.csv' (HEADER, DELIMITER ',');
```

### Export to Parquet

```sql
COPY documents TO 'embeddings_backup.parquet' (FORMAT PARQUET);
```

## Using DuckDB CLI

You can query the database directly from the DuckDB CLI:

```bash
# Open the database
duckdb sqlrooms_docs

# Run queries interactively
D SELECT COUNT(*) FROM documents;
D SELECT DISTINCT metadata_->>'$.file_name' FROM documents LIMIT 10;
D .quit
```

## Integration Examples

### Using in a Web Application

```python
import duckdb
from fastapi import FastAPI
from sentence_transformers import SentenceTransformer

app = FastAPI()
model = SentenceTransformer("BAAI/bge-small-en-v1.5")

@app.get("/search")
def search(q: str, limit: int = 5):
    embedding = model.encode(q).tolist()
    conn = duckdb.connect("sqlrooms_docs", read_only=True)
    
    results = conn.execute("""
        SELECT 
            text,
            metadata_,
            array_cosine_similarity(embedding, ?::FLOAT[384]) as score
        FROM documents
        ORDER BY score DESC
        LIMIT ?
    """, [embedding, limit]).fetchall()
    
    conn.close()
    
    return {
        "query": q,
        "results": [
            {"text": r[0], "metadata": r[1], "score": r[2]}
            for r in results
        ]
    }
```

### Using with JavaScript/TypeScript

```typescript
import Database from 'duckdb-async';

const db = await Database.create('sqlrooms_docs');

// Query documents (you'll need to generate embeddings separately)
const results = await db.all(`
  SELECT text, metadata_
  FROM documents
  WHERE text LIKE '%query%'
  LIMIT 10
`);

console.log(results);
```

## Performance Tips

1. **Use prepared statements** for repeated queries
2. **Add indexes** if needed (DuckDB auto-optimizes but you can create explicit indexes)
3. **Use LIMIT** to restrict result sets
4. **Consider batch processing** for multiple queries
5. **Read-only connections** are faster when you don't need to write

## Troubleshooting

### Database Locked Error
If you get a lock error, make sure the database isn't open in another process:
```bash
# Close any open DuckDB CLI sessions
# Or use read_only=True in Python: duckdb.connect(path, read_only=True)
```

### Wrong Embedding Dimensions
Make sure your query embeddings match the database dimensions:
```python
# For bge-small-en-v1.5: 384 dimensions
# Cast as FLOAT[384] in SQL
array_cosine_similarity(embedding, ?::FLOAT[384])
```

## See Also

- [DuckDB Documentation](https://duckdb.org/docs/)
- [DuckDB Vector Functions](https://duckdb.org/docs/extensions/vss)
- [Sentence Transformers](https://www.sbert.net/)

