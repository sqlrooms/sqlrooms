#!/bin/bash
# Download DuckDB documentation and prepare embeddings
#
# Usage:
#   ./prepare_duckdb_docs.sh [docs_dir] [output_db]
#
# Examples:
#   ./prepare_duckdb_docs.sh
#   ./prepare_duckdb_docs.sh ./my-docs ./my-embeddings/duckdb.duckdb

set -e

# Default values
DOCS_DIR="${1:-./downloaded-docs/duckdb}"
OUTPUT_DB="${2:-./generated-embeddings/duckdb_docs.duckdb}"
DOCS_REPO="duckdb/duckdb-web/docs/stable"

echo "=========================================="
echo "DuckDB Documentation Embedding Preparation"
echo "=========================================="
echo ""
echo "Docs directory: $DOCS_DIR"
echo "Output database: $OUTPUT_DB"
echo ""

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo "Error: npx not found. Please install Node.js."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check if docs already exist
if [ -d "$DOCS_DIR" ]; then
    echo "Directory $DOCS_DIR already exists."
    read -p "Delete and re-download? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing $DOCS_DIR..."
        rm -rf "$DOCS_DIR"
    else
        echo "Using existing documentation."
    fi
fi

# Download docs if directory doesn't exist
if [ ! -d "$DOCS_DIR" ]; then
    echo "Downloading DuckDB documentation from GitHub..."
    echo "Repository: $DOCS_REPO"
    npx giget gh:"$DOCS_REPO" "$DOCS_DIR"
    echo "✓ Downloaded documentation to $DOCS_DIR"
fi

# Count markdown files
MD_COUNT=$(find "$DOCS_DIR" -name "*.md" -type f | wc -l)
echo "Found $MD_COUNT markdown files"
echo ""

# Prepare embeddings
echo "=========================================="
echo "Preparing embeddings..."
echo "=========================================="
echo ""

uv run prepare-embeddings "$DOCS_DIR" -o "$OUTPUT_DB"

echo ""
echo "=========================================="
echo "✓ DuckDB documentation embeddings ready!"
echo "✓ Database: $OUTPUT_DB"
echo "=========================================="
echo ""
echo "Example usage in TypeScript:"
cat << 'EOF'

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

// Query the documentation
const results = await store.getState().rag.queryEmbeddings(embedding, {
  topK: 5,
});

EOF

