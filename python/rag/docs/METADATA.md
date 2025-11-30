# Embedding Metadata

Comprehensive metadata tracking ensures reproducibility, version compatibility, and easier debugging of RAG systems.

## What is Stored

Every time you run `prepare_embeddings()`, the system automatically creates and stores metadata about:

### 1. Embedding Model
- Provider (huggingface/openai)
- Model name
- Embedding dimensions

### 2. Chunking Strategy
- Strategy used (markdown-aware/size-based)
- Configured chunk size
- Header inclusion settings
- Header weight multiplier

### 3. Source Documents
- Total number of documents processed
- Number of unique files
- Total character count

### 4. Chunks
- Total number of chunks created
- Min/max/median/mean chunk sizes
- Total characters in all chunks

### 5. Capabilities
- Hybrid search enabled
- Full-text search (FTS) enabled
- Source documents stored

### 6. Timestamps
- When the database was created
- Metadata format version

## Where is it Stored?

Metadata is stored in **two places** for convenience:

### 1. Inside the Database (`embedding_metadata` table)

```sql
SELECT * FROM embedding_metadata;
```

This allows runtime validation:
```python
from sqlrooms_rag import get_embedding_metadata

metadata = get_embedding_metadata("kb.duckdb")
print(f"Model: {metadata['embedding']['model']}")
```

### 2. As a YAML File (next to .duckdb file)

Example: `knowledge_base.duckdb` → `knowledge_base.yaml`

```yaml
version: '1.0'
created_at: '2024-11-21T18:30:00Z'
embedding:
  provider: openai
  model: text-embedding-3-small
  dimensions: 1536
chunking:
  strategy: markdown-aware
  chunk_size: 512
  include_headers: true
  header_weight: 3
source_documents:
  total_documents: 150
  unique_files: 145
  total_characters: 2500000
chunks:
  total_chunks: 5234
  min_chunk_size: 100
  max_chunk_size: 4500
  median_chunk_size: 450
  mean_chunk_size: 478
  total_characters: 2503452
capabilities:
  hybrid_search: true
  fts_enabled: true
  source_documents_stored: true
```

## Why This Matters

### 1. **Version Compatibility**

You **must** use the same embedding model for queries as was used during preparation:

```python
# Wrong - will give poor results!
prepare_embeddings(..., embed_model_name="BAAI/bge-small-en-v1.5")
# Later...
query_with_model("text-embedding-3-small")  # Different model!

# Right - consistent model
prepare_embeddings(..., embed_model_name="BAAI/bge-small-en-v1.5")
# Later...
query_with_model("BAAI/bge-small-en-v1.5")  # Same model ✓
```

### 2. **Automatic Validation**

```python
from sqlrooms_rag import validate_embedding_model

# Returns True/False and prints warnings
is_valid = validate_embedding_model(
    db_path="kb.duckdb",
    model_name="BAAI/bge-small-en-v1.5"
)
```

### 3. **Debugging**

When results are poor, check metadata:
- Are you using the correct model?
- What chunk size was used?
- Are chunks too large/small?

### 4. **Documentation**

The YAML file serves as documentation:
- What settings were used?
- When was it created?
- What capabilities are available?

### 5. **Reproducibility**

Need to recreate the database? The metadata tells you exactly:
- Which model to use
- What chunk size
- Whether headers were included
- Header weight setting

## Inspecting Metadata

### Python API

```python
from sqlrooms_rag import get_embedding_metadata

# Get all metadata
metadata = get_embedding_metadata("kb.duckdb")

# Check specific fields
print(f"Model: {metadata['embedding']['model']}")
print(f"Dimensions: {metadata['embedding']['dimensions']}")
print(f"Chunks: {metadata['chunks']['total_chunks']}")
```

### CLI Tool

```bash
# Inspect database
python examples/inspect_metadata.py --inspect kb.duckdb

# Validate model compatibility
python examples/inspect_metadata.py --validate kb.duckdb "BAAI/bge-small-en-v1.5"

# Compare two databases
python examples/inspect_metadata.py --compare db1.duckdb db2.duckdb
```

### Direct SQL

```bash
duckdb kb.duckdb

SELECT * FROM embedding_metadata;
SELECT value FROM embedding_metadata WHERE key = 'embedding_model';
```

### YAML File

```bash
# View metadata
cat knowledge_base.yaml

# Or with python
python -c "import yaml; print(yaml.safe_load(open('knowledge_base.yaml')))"
```

## Common Scenarios

### Scenario 1: Model Mismatch

**Problem:**
```
Created database with: text-embedding-3-small (1536 dims)
Querying with: BAAI/bge-small-en-v1.5 (384 dims)
Result: Completely wrong results
```

**Solution:**
```python
# Check metadata first
metadata = get_embedding_metadata("kb.duckdb")
print(f"Use model: {metadata['embedding']['model']}")

# Or use validation
validate_embedding_model("kb.duckdb", "your-model")
```

### Scenario 2: Debugging Poor Results

**Check:**
1. Model compatibility (see above)
2. Chunk sizes - are they appropriate?
   ```python
   metadata = get_embedding_metadata("kb.duckdb")
   print(f"Median chunk: {metadata['chunks']['median_chunk_size']} chars")
   ```
3. Chunking strategy - markdown-aware vs size-based?
4. Header weighting - too high/low?

### Scenario 3: Reproducing a Database

**From metadata:**
```yaml
# knowledge_base.yaml shows:
embedding:
  provider: openai
  model: text-embedding-3-small
  dimensions: 1536
chunking:
  chunk_size: 512
  header_weight: 3
```

**Reproduce:**
```bash
uv run prepare-embeddings docs -o kb_new.duckdb \
  --provider openai \
  --model text-embedding-3-small \
  --embed-dim 1536 \
  --chunk-size 512 \
  --header-weight 3
```

### Scenario 4: Migrating to New Model

**Check current setup:**
```python
metadata = get_embedding_metadata("old_kb.duckdb")
# Shows: BAAI/bge-small-en-v1.5 (384 dims)
```

**Create new database with different model:**
```bash
uv run prepare-embeddings docs -o new_kb.duckdb \
  --provider openai \
  --model text-embedding-3-small \
  --embed-dim 1536
```

**Compare:**
```bash
python examples/inspect_metadata.py --compare old_kb.duckdb new_kb.duckdb
```

## Metadata Schema

### Database Table Schema

```sql
CREATE TABLE embedding_metadata (
    key VARCHAR PRIMARY KEY,
    value VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Available Keys

| Key | Description | Example |
|-----|-------------|---------|
| `version` | Metadata format version | `1.0` |
| `created_at` | ISO 8601 timestamp | `2024-11-21T18:30:00Z` |
| `embedding_provider` | Provider name | `openai`, `huggingface` |
| `embedding_model` | Model identifier | `text-embedding-3-small` |
| `embedding_dimensions` | Vector dimensions | `1536` |
| `chunking_strategy` | Strategy used | `markdown-aware`, `size-based` |
| `chunk_size` | Configured chunk size | `512` |
| `include_headers` | Headers included | `true`, `false` |
| `header_weight` | Header repetition | `3` |
| `total_source_documents` | Document count | `150` |
| `unique_files` | Unique file count | `145` |
| `source_total_characters` | Total chars | `2500000` |
| `total_chunks` | Chunk count | `5234` |
| `min_chunk_size` | Smallest chunk | `100` |
| `max_chunk_size` | Largest chunk | `4500` |
| `median_chunk_size` | Median chunk | `450` |
| `mean_chunk_size` | Average chunk | `478` |
| `chunks_total_characters` | Total chunk chars | `2503452` |
| `hybrid_search_enabled` | Hybrid capability | `true` |
| `fts_enabled` | FTS capability | `true` |
| `source_documents_stored` | Source docs stored | `true` |

## Best Practices

### 1. Always Check Metadata Before Querying

```python
from sqlrooms_rag import get_embedding_metadata, validate_embedding_model

# Get metadata
metadata = get_embedding_metadata("kb.duckdb")

# Validate before querying
if not validate_embedding_model("kb.duckdb", "your-model"):
    raise ValueError("Model mismatch!")
```

### 2. Store YAML Files in Version Control

```bash
# Add to git
git add knowledge_base.yaml

# Document what the database contains
# The YAML is human-readable and tiny
```

### 3. Include Metadata in Error Messages

```python
try:
    results = query_database(...)
except Exception as e:
    metadata = get_embedding_metadata("kb.duckdb")
    print(f"Error querying database:")
    print(f"  Model: {metadata['embedding']['model']}")
    print(f"  Chunks: {metadata['chunks']['total_chunks']}")
    print(f"  Error: {e}")
```

### 4. Compare Before Merging

```python
# Before combining results from multiple databases
metadata1 = get_embedding_metadata("db1.duckdb")
metadata2 = get_embedding_metadata("db2.duckdb")

if metadata1['embedding']['model'] != metadata2['embedding']['model']:
    raise ValueError("Cannot merge databases with different models!")
```

## Future Enhancements

Potential additions to metadata:

- **Processing time**: How long did embedding take?
- **Cost estimates**: For API-based embeddings (OpenAI)
- **Git commit hash**: Which version of docs were processed?
- **Custom tags**: User-defined metadata
- **Quality metrics**: Average similarity scores, etc.
- **Language detection**: What languages are in the docs?

Open an issue if you need additional metadata fields!

## References

- [Example Script: inspect_metadata.py](../examples/inspect_metadata.py)
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [EXTERNAL_APIS.md](./EXTERNAL_APIS.md) - Using external APIs

