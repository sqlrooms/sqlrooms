# SQLRooms Embedding Preparation Tool

A Python tool to prepare vector embeddings from markdown files and store them in DuckDB for use in RAG (Retrieval Augmented Generation) applications.

## Overview

This tool follows the approach outlined in [Developing a RAG Knowledge Base with DuckDB](https://motherduck.com/blog/search-using-duckdb-part-2/) to:

1. Load markdown files from a specified directory
2. Split them into chunks (default 512 tokens)
3. Generate vector embeddings using HuggingFace models
4. Store the embeddings in a DuckDB database for efficient retrieval

## Installation

This project uses [uv](https://github.com/astral-sh/uv) for fast Python package management.

### Install uv (if not already installed)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Install dependencies

```bash
cd python/embedding
uv sync
```

This will create a virtual environment and install all required dependencies including:

- llama-index
- llama-index-embeddings-huggingface
- llama-index-vector-stores-duckdb
- sentence-transformers
- torch

## Usage

### Basic Usage

Process markdown files from a directory and create a DuckDB knowledge base:

```bash
uv run prepare-embeddings /path/to/docs -o knowledge_base.duckdb
```

Or using the script directly:

```bash
uv run python prepare_embeddings.py /path/to/docs -o knowledge_base.duckdb
```

### Examples

#### Process documentation files

```bash
# Process all .md files in the docs directory
uv run prepare-embeddings ../../docs -o sqlrooms_docs.duckdb
```

#### Use custom chunk size

```bash
# Use smaller chunks for more granular retrieval
uv run prepare-embeddings docs -o kb.duckdb --chunk-size 256
```

#### Use a different embedding model

```bash
# Use all-MiniLM-L6-v2 (dimension: 384)
uv run prepare-embeddings docs -o kb.duckdb \
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

See `example_query.py` for a complete working example. Here's a quick snippet:

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

**Using llama-index (high-level):**

```bash
uv run python example_query.py
```

**Using DuckDB directly (more control):**

```bash
# Run predefined queries
uv run python query_duckdb_direct.py

# Query with your own question
uv run python query_duckdb_direct.py "Your question here"
```

See [QUERYING.md](./QUERYING.md) for detailed documentation on querying the database directly with SQL.

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
