# SQLRooms RAG

A Python package for preparing and querying vector embeddings stored in DuckDB for RAG (Retrieval Augmented Generation) applications.

## Overview

This tool follows the approach outlined in [Developing a RAG Knowledge Base with DuckDB](https://motherduck.com/blog/search-using-duckdb-part-2/) to:

1. Load markdown files from a specified directory
2. Split them into chunks (default 512 tokens)
3. Generate vector embeddings using HuggingFace models
4. Store the embeddings in a DuckDB database for efficient retrieval

## Installation

### From PyPI (when published)

```bash
pip install sqlrooms-rag
```

### From source with uv

This project uses [uv](https://github.com/astral-sh/uv) for development.

```bash
# Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install from source
cd python/rag-embedding
uv sync
```

### Dependencies

**Core dependencies** (always installed):

- llama-index (core RAG framework)
- llama-index-embeddings-huggingface (HuggingFace embeddings)
- llama-index-vector-stores-duckdb (DuckDB vector store)
- sentence-transformers (embedding models)
- torch (ML framework)
- duckdb (database)

**Optional dependencies:**

For OpenAI embeddings:

```bash
pip install llama-index-embeddings-openai
# or with uv
uv pip install llama-index-embeddings-openai
```

## Usage

### Basic Usage

Process markdown files from a directory and create a DuckDB knowledge base:

```bash
uv run prepare-embeddings /path/to/docs -o generated-embeddings/knowledge_base.duckdb
```

Or use the Python API:

```python
from sqlrooms_rag import prepare_embeddings

# Using local HuggingFace embeddings (default, free)
prepare_embeddings(
    input_dir="/path/to/docs",
    output_db="generated-embeddings/knowledge_base.duckdb",
    embedding_provider="huggingface",  # default
    embed_model_name="BAAI/bge-small-en-v1.5",  # default
    chunk_size=512,
)

# Using OpenAI embeddings (requires API key, paid)
prepare_embeddings(
    input_dir="/path/to/docs",
    output_db="generated-embeddings/knowledge_base.duckdb",
    embedding_provider="openai",
    api_key="your-openai-api-key",  # or set OPENAI_API_KEY env var
    # embed_model_name defaults to "text-embedding-3-small"
    # embed_dim defaults to 1536 for OpenAI models
)
```

### Examples

#### Process documentation files

```bash
# Process all .md files in the docs directory
uv run prepare-embeddings ../../docs -o generated-embeddings/sqlrooms_docs.duckdb
```

#### Use custom chunk size

```bash
# Use smaller chunks for more granular retrieval
uv run prepare-embeddings docs -o generated-embeddings/kb.duckdb --chunk-size 256
```

#### Use a different embedding model

```bash
# Use all-MiniLM-L6-v2 (dimension: 384)
uv run prepare-embeddings docs -o generated-embeddings/kb.duckdb \
  --model "sentence-transformers/all-MiniLM-L6-v2" \
  --embed-dim 384
```

### Command-Line Options

```
positional arguments:
  input_dir             Directory containing markdown (.md) files to process

options:
  -h, --help            Show this help message and exit
  -o OUTPUT, --output OUTPUT
                        Output DuckDB database file path (default: knowledge_base.duckdb)
  --chunk-size CHUNK_SIZE
                        Max token size for text chunks (default: 512)
  --model EMBED_MODEL_NAME
                        HuggingFace embedding model name (default: BAAI/bge-small-en-v1.5)
  --embed-dim EMBED_DIM
                        Embedding dimension size (default: 384 for bge-small-en-v1.5)
  --no-markdown-chunking
                        Disable markdown-aware chunking (use size-based instead)
  -q, --quiet           Suppress progress messages
```

## How It Works

1. **Document Loading**: The tool recursively scans the input directory for `.md` files
2. **Embedding Model**: Downloads and initializes the HuggingFace embedding model (cached locally after first run)
3. **Smart Chunking**: By default, splits documents by markdown headers (##, ###) to preserve section context. Section titles are stored in metadata for better retrieval. Falls back to size-based chunking for large sections.
4. **Embedding Generation**: Generates vector embeddings for each chunk
5. **Storage**: Stores embeddings in DuckDB with metadata (including section titles) for efficient retrieval

### Chunking Strategy

**Markdown-Aware Chunking** (default):

- ✅ Splits by markdown headers (`##`, `###`, etc.)
- ✅ Preserves section context and hierarchy
- ✅ Stores section titles in metadata (`Header_1`, `Header_2`, etc.)
- ✅ Produces semantically coherent chunks

**Size-Based Chunking** (with `--no-markdown-chunking`):

- Simple token-based splitting
- May break sections mid-content
- Use only if your docs lack clear structure

See [CHUNKING.md](./docs/CHUNKING.md) for detailed comparison and best practices.

## Output

The tool creates **two files**:

### 1. DuckDB Database (`.duckdb`)

Contains:

- **Chunks**: Text split by markdown sections with embeddings
- **Source documents**: Original full documents before chunking
- **Embeddings**: Vector embeddings (384-1536 dimensional)
- **FTS index**: Full-text search index for hybrid retrieval
- **Metadata table**: Model info, settings, statistics
- **Metadata** per chunk:
  - File paths
  - Section titles (`Header_1`, `Header_2`, etc.)
  - Document structure information

### 2. Metadata YAML (`.yaml`)

Human-readable file documenting:

- Embedding model used (provider, name, dimensions)
- Chunking strategy and parameters
- Document and chunk statistics
- Available capabilities
- Creation timestamp

**Why?** The metadata ensures:

- ✓ Query-time uses the same model
- ✓ Easy debugging of poor results
- ✓ Reproducible builds
- ✓ Version compatibility checks

See [METADATA.md](./docs/METADATA.md) for details.

## Using the Generated Database

### Python API

You can use the package programmatically:

```python
from sqlrooms_rag import prepare_embeddings

# Create embeddings
index = prepare_embeddings(
    input_dir="../../docs",
    output_db="generated-embeddings/my_docs.duckdb"
)
```

### Query Examples

#### Hybrid Search (Recommended)

Combines vector similarity with full-text search for better results:

```python
from sqlrooms_rag import hybrid_query, print_results, get_source_documents

# Query using both vector similarity and keyword matching
# FTS index is created automatically during prepare_embeddings()
results = hybrid_query(
    "What is the ARRAY_AGG function in DuckDB?",
    db_path="generated-embeddings/knowledge_base.duckdb",
    top_k=5,
    use_rrf=True,  # Reciprocal Rank Fusion
)

print_results(results, query_text)

# Optionally retrieve full source documents for context
chunk_ids = [r['node_id'] for r in results]
source_docs = get_source_documents(chunk_ids, db_path)
for doc in source_docs:
    print(f"Full document: {doc['file_name']}")
```

**Why hybrid?** Combines semantic understanding (vector search) with exact keyword matching (FTS). Best for technical queries with specific terms, function names, or acronyms. See [HYBRID_SEARCH.md](./docs/HYBRID_SEARCH.md) for details.

**New features:**

- Full source documents stored alongside chunks for complete context
- Comprehensive metadata tracking (model, settings, stats)
- Automatic model validation at query time

#### Vector-Only Search

Using llama-index (see `examples/example_query.py`):

```python
from llama_index.core import VectorStoreIndex, StorageContext, Settings
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.duckdb import DuckDBVectorStore

# Load the embedding model
embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")
Settings.embed_model = embed_model

# Connect to the existing database
vector_store = DuckDBVectorStore(
    database_name="knowledge_base",
    persist_dir="./",
    embed_dim=384,
)

# Load the index
index = VectorStoreIndex.from_vector_store(vector_store)

# Create retriever and search
retriever = index.as_retriever(similarity_top_k=3)
results = retriever.retrieve("Your question here")

for result in results:
    print(f"Score: {result.score:.4f}")
    print(f"Text: {result.text[:200]}...")
```

### Running the Examples

**Prepare DuckDB documentation embeddings:**

```bash
# Using Python script (recommended)
uv run python examples/prepare_duckdb_docs.py

# Or using bash script
chmod +x examples/prepare_duckdb_docs.sh
./examples/prepare_duckdb_docs.sh

# Custom paths
uv run python examples/prepare_duckdb_docs.py \
  --docs-dir ./my-docs \
  --output ./embeddings/duckdb.duckdb
```

**Query embeddings using llama-index:**

```bash
uv run python examples/example_query.py
```

**Query embeddings using DuckDB directly:**

```bash
# Run predefined queries
uv run python examples/query_duckdb_direct.py

# Query with your own question
uv run python examples/query_duckdb_direct.py "Your question here"
```

**Hybrid search (vector + full-text):**

```bash
# Run hybrid search examples
uv run python examples/hybrid_search_example.py

# Compare methods side-by-side
uv run python examples/hybrid_search_example.py --compare
```

**Inspect metadata:**

```bash
# View database metadata
uv run python examples/inspect_metadata.py --inspect kb.duckdb

# Validate model compatibility
uv run python examples/inspect_metadata.py --validate kb.duckdb "BAAI/bge-small-en-v1.5"
```

See [QUERYING.md](./docs/QUERYING.md) for detailed documentation on querying the database directly with SQL, [HYBRID_SEARCH.md](./docs/HYBRID_SEARCH.md) for hybrid retrieval details, and [METADATA.md](./docs/METADATA.md) for metadata tracking.

## Visualization

Generate 2D UMAP embeddings for visualization:

```bash
# Install visualization dependencies
uv pip install -e ".[viz]"

# Generate UMAP visualization
uv run generate-umap-embeddings generated-embeddings/duckdb_docs.duckdb

# Output: generated-embeddings/duckdb_docs_umap.parquet
```

The output includes two Parquet files:

**Main file (`*_umap.parquet`):**

- `node_id` - Unique node identifier (e.g., "node_0001")
- `title` - Document title (from markdown frontmatter)
- `fileName` - File name extracted from metadata (e.g., "window_functions")
- `file_path` - Full file path (e.g., "/path/to/docs/window_functions.md")
- `text` - Full document text
- `x`, `y` - UMAP coordinates for 2D plotting
- `topic` - Automatically detected topic/cluster name (e.g., "Window Functions / Aggregate / SQL")
- `outdegree` - Number of documents this document links TO
- `indegree` - Number of documents linking TO this document

**Links file (`*_umap_links.parquet`):**

- `source_id` - Source node ID
- `target_id` - Target node ID

**Features:**

- **Topic Detection:** Automatically clusters documents and assigns descriptive topic names using TF-IDF keyword extraction. Disable with `--no-topics`.
- **Link Extraction:** Parses markdown links to build a chunk-level graph. Source chunks keep individual outdegree values; target documents expand to all chunks. Disable with `--no-links`.

See [VISUALIZATION_GUIDE.md](./docs/VISUALIZATION_GUIDE.md) for complete visualization examples and usage details.

See [CHUNKING.md](./docs/CHUNKING.md) for information about markdown-aware chunking.

## Package Structure

```
sqlrooms-rag/
├── sqlrooms_rag/           # Main package (installed)
│   ├── __init__.py        # Public API
│   ├── prepare.py         # Core embedding preparation
│   ├── query.py           # Hybrid retrieval (vector + FTS)
│   ├── generate_umap.py   # UMAP visualization
│   └── cli.py             # Command-line interface
├── examples/               # Example scripts (not installed)
│   ├── prepare_duckdb_docs.py   # Download & prepare DuckDB docs
│   ├── prepare_duckdb_docs.sh   # Bash version of above
│   ├── prepare_with_openai.py   # Using OpenAI API for embeddings
│   ├── test_duckdb_docs_query.py  # Test DuckDB docs queries
│   ├── example_query.py         # Query using llama-index
│   ├── query_duckdb_direct.py   # Direct DuckDB queries (including hybrid)
│   ├── hybrid_search_example.py # Hybrid search examples
│   └── inspect_metadata.py      # Inspect and validate metadata
├── scripts/                # Documentation for utility scripts
├── generated-embeddings/   # Output directory
├── pyproject.toml         # Package configuration
├── README.md
├── HYBRID_SEARCH.md       # Hybrid retrieval documentation
├── EXTERNAL_APIS.md       # Using external embedding APIs (OpenAI, etc.)
├── ARCHITECTURE.md        # System architecture and design decisions
├── QUERYING.md            # Query documentation
├── CHUNKING.md            # Chunking strategies
└── VISUALIZATION_GUIDE.md # UMAP visualization guide
```

## Example: DuckDB Documentation

The package includes a ready-to-use script for preparing DuckDB documentation embeddings:

```bash
# Download DuckDB docs and create embeddings
cd python/rag
uv run python examples/prepare_duckdb_docs.py
```

This will:

1. Download the latest DuckDB documentation from GitHub (~600+ files)
2. Process all markdown files
3. Generate embeddings using BAAI/bge-small-en-v1.5
4. Create `generated-embeddings/duckdb_docs.duckdb`

Test the embeddings:

```bash
# Run interactive test queries
uv run python examples/test_duckdb_docs_query.py

# Or test a specific query
uv run python examples/test_duckdb_docs_query.py "What is a window function?"
```

Then use it in your SQLRooms app:

```typescript
import {createRagSlice} from '@sqlrooms/ai-rag';

const store = createRoomStore({
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

// Search DuckDB documentation
const results = await store.getState().rag.queryEmbeddings(embedding);
```

## Embedding Providers

### HuggingFace (Local, Free)

Uses local sentence-transformer models. No API costs, works offline.

| Model                                   | Dimension | Max Tokens | Description           |
| --------------------------------------- | --------- | ---------- | --------------------- |
| BAAI/bge-small-en-v1.5                  | 384       | 512        | Default, good balance |
| sentence-transformers/all-MiniLM-L6-v2  | 384       | 256        | Fast, lightweight     |
| BAAI/bge-base-en-v1.5                   | 768       | 512        | Better accuracy       |
| sentence-transformers/all-mpnet-base-v2 | 768       | 384        | High quality          |

**Pros:** Free, fast for large datasets, works offline, data stays local
**Cons:** Requires model download (~150MB), slower on CPU-only machines

### OpenAI (API, Paid)

Uses OpenAI's embedding API. Requires API key and internet connection.

| Model                  | Dimension      | Cost (per 1M tokens) | Description                  |
| ---------------------- | -------------- | -------------------- | ---------------------------- |
| text-embedding-3-small | 1536 (or less) | $0.02                | Best value, high quality     |
| text-embedding-3-large | 3072 (or less) | $0.13                | Highest quality              |
| text-embedding-ada-002 | 1536           | $0.10                | Legacy (use 3-small instead) |

**Pros:** High quality, no local storage, consistent results
**Cons:** Costs money, requires internet, API latency, data sent to OpenAI

**Note:** OpenAI's v3 models support dimension reduction (e.g., 512 dims) while maintaining quality.

**Usage:**

```bash
# Using HuggingFace (default)
uv run prepare-embeddings docs -o kb.duckdb

# Using OpenAI
export OPENAI_API_KEY=your_key_here
uv run prepare-embeddings docs -o kb.duckdb --provider openai

# OpenAI with custom model and dimensions
uv run prepare-embeddings docs -o kb.duckdb \
  --provider openai \
  --model text-embedding-3-large \
  --embed-dim 1024
```

See `examples/prepare_with_openai.py` for detailed examples and cost estimates.

**Complete guide:** See [EXTERNAL_APIS.md](./docs/EXTERNAL_APIS.md) for full documentation on using external embedding APIs.

## Notes

- The embedding model is downloaded and cached on first run (~100-500MB depending on model)
- Processing time depends on the number and size of documents
- The generated DuckDB file can be reused and updated with additional documents
- Ensure the `--embed-dim` matches your chosen model's output dimension

## Requirements

- Python >=3.10
- 2-4GB RAM (depending on model and document size)
- ~500MB-2GB disk space for models and generated database

## Troubleshooting

### OpenAI Token Limit Errors

**The system automatically validates and splits chunks** that exceed OpenAI's 8192 token limit.

**If you still get token limit errors**, use more conservative settings:

```bash
# Recommended: small chunks + minimal header weight
uv run prepare-embeddings docs -o kb.duckdb \
  --provider openai \
  --chunk-size 256 \
  --header-weight 1

# If that fails: disable header weighting entirely
uv run prepare-embeddings docs -o kb.duckdb \
  --provider openai \
  --chunk-size 256 \
  --no-header-weighting

# Last resort: disable markdown chunking
uv run prepare-embeddings docs -o kb.duckdb \
  --provider openai \
  --chunk-size 256 \
  --no-markdown-chunking
```

**Why this happens:**

- Markdown-aware chunking can create very large chunks from huge document sections
- Header weighting multiplies chunk size (3x weight = 3x tokens)
- Token estimation isn't perfect
- Technical text has higher token density

See [EXTERNAL_APIS.md](./docs/EXTERNAL_APIS.md#openai-token-limits) for details.

### Out of Memory

If you run out of memory with large document sets, try:

- Using a smaller embedding model
- Processing documents in batches
- Reducing chunk size

### Slow Processing

- First run downloads the embedding model (one-time operation)
- Subsequent runs use the cached model
- Consider using a smaller/faster model for large document sets
- OpenAI API has higher latency but doesn't need local models

## License

Part of the SQLRooms project.
