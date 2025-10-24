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

The package includes:

- llama-index (core RAG framework)
- llama-index-embeddings-huggingface (HuggingFace embeddings)
- llama-index-vector-stores-duckdb (DuckDB vector store)
- sentence-transformers (embedding models)
- torch (ML framework)
- duckdb (database)

## Usage

### Basic Usage

Process markdown files from a directory and create a DuckDB knowledge base:

```bash
uv run prepare-embeddings /path/to/docs -o generated-embeddings/knowledge_base.duckdb
```

Or use the Python API:

```python
from sqlrooms_rag import prepare_embeddings

prepare_embeddings(
    input_dir="/path/to/docs",
    output_db="generated-embeddings/knowledge_base.duckdb",
    chunk_size=512,
    embed_model_name="BAAI/bge-small-en-v1.5",
    embed_dim=384
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
                        Size of text chunks in tokens (default: 512)
  --model EMBED_MODEL_NAME
                        HuggingFace embedding model name (default: BAAI/bge-small-en-v1.5)
  --embed-dim EMBED_DIM
                        Embedding dimension size (default: 384 for bge-small-en-v1.5)
```

## How It Works

1. **Document Loading**: The tool recursively scans the input directory for `.md` files
2. **Embedding Model**: Downloads and initializes the HuggingFace embedding model (cached locally after first run)
3. **Chunking**: Splits documents into chunks based on the specified token size
4. **Embedding Generation**: Generates vector embeddings for each chunk
5. **Storage**: Stores embeddings in DuckDB with metadata for efficient retrieval

## Output

The tool creates a DuckDB database file (`.duckdb`) that contains:

- Document chunks (text)
- Vector embeddings (384-dimensional by default)
- Metadata for retrieval

This database can be used with llama-index's query engine or any RAG application that supports DuckDB vector stores.

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

See `examples/example_query.py` for complete working examples. Here's a quick snippet:

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

See [QUERYING.md](./QUERYING.md) for detailed documentation on querying the database directly with SQL.

## Visualization

Generate 2D UMAP embeddings for visualization:

```bash
# Install visualization dependencies
uv pip install -e ".[viz]"

# Generate UMAP visualization
uv run generate-umap-embeddings generated-embeddings/duckdb_docs.duckdb

# Output: generated-embeddings/duckdb_docs_umap.parquet
```

The output Parquet file contains:

- `title` - Document title (from markdown frontmatter)
- `fileName` - File name (from metadata)
- `text` - Full document text
- `x`, `y` - UMAP coordinates for 2D plotting
- `topic` - Automatically detected topic/cluster name (e.g., "Window Functions / Aggregate / SQL")

**Topic Detection:**
The script automatically clusters documents and assigns descriptive topic names using TF-IDF keyword extraction. Disable with `--no-topics`.

See [VISUALIZATION_GUIDE.md](./VISUALIZATION_GUIDE.md) for complete visualization examples and usage details.

## Package Structure

```
sqlrooms-rag/
├── sqlrooms_rag/           # Main package (installed)
│   ├── __init__.py        # Public API
│   ├── prepare.py         # Core embedding preparation
│   └── cli.py             # Command-line interface
├── examples/               # Example scripts (not installed)
│   ├── prepare_duckdb_docs.py   # Download & prepare DuckDB docs
│   ├── prepare_duckdb_docs.sh   # Bash version of above
│   ├── test_duckdb_docs_query.py  # Test DuckDB docs queries
│   ├── example_query.py         # Query using llama-index
│   └── query_duckdb_direct.py   # Direct DuckDB queries
├── scripts/                # Documentation for utility scripts
├── generated-embeddings/   # Output directory
├── pyproject.toml         # Package configuration
└── README.md
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
import {createRagSlice} from '@sqlrooms/rag';

const store = createRoomStore({
  slices: [
    createDuckDbSlice(),
    createRagSlice({
      embeddingsDatabases: [
        {
          databaseFilePath: './embeddings/duckdb_docs.duckdb',
          databaseName: 'duckdb_docs',
        },
      ],
    }),
  ],
});

// Search DuckDB documentation
const results = await store.getState().rag.queryEmbeddings(embedding);
```

## Supported Models

The tool works with any HuggingFace sentence-transformer model. Popular choices:

| Model                                   | Dimension | Max Tokens | Description           |
| --------------------------------------- | --------- | ---------- | --------------------- |
| BAAI/bge-small-en-v1.5                  | 384       | 512        | Default, good balance |
| sentence-transformers/all-MiniLM-L6-v2  | 384       | 256        | Fast, lightweight     |
| BAAI/bge-base-en-v1.5                   | 768       | 512        | Better accuracy       |
| sentence-transformers/all-mpnet-base-v2 | 768       | 384        | High quality          |

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

### Out of Memory

If you run out of memory with large document sets, try:

- Using a smaller embedding model
- Processing documents in batches
- Reducing chunk size

### Slow Processing

- First run downloads the embedding model (one-time operation)
- Subsequent runs use the cached model
- Consider using a smaller/faster model for large document sets

## License

Part of the SQLRooms project.
