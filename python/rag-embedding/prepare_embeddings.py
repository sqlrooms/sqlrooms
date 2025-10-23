#!/usr/bin/env python3
"""
Prepare embeddings from markdown files and store them in a DuckDB database.

This script loads markdown files from a specified directory, generates vector
embeddings using a HuggingFace model, and stores them in a DuckDB database for
later retrieval in RAG (Retrieval Augmented Generation) applications.
"""

import argparse
import sys
from pathlib import Path

from llama_index.core import (
    StorageContext,
    VectorStoreIndex,
    SimpleDirectoryReader,
    Settings,
)
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.duckdb import DuckDBVectorStore


def prepare_embeddings(
    input_dir: str,
    output_db: str,
    chunk_size: int = 512,
    embed_model_name: str = "BAAI/bge-small-en-v1.5",
    embed_dim: int = 384,
):
    """
    Prepare embeddings from markdown files and store in DuckDB.

    Args:
        input_dir: Directory containing .md files to process
        output_db: Path to output DuckDB database file (without extension)
        chunk_size: Size of text chunks in tokens (default: 512)
        embed_model_name: HuggingFace model name (default: BAAI/bge-small-en-v1.5)
        embed_dim: Embedding dimension size (default: 384 for bge-small)
    """
    input_path = Path(input_dir)
    
    # Validate input directory
    if not input_path.exists():
        print(f"Error: Input directory '{input_dir}' does not exist.", file=sys.stderr)
        sys.exit(1)
    
    if not input_path.is_dir():
        print(f"Error: '{input_dir}' is not a directory.", file=sys.stderr)
        sys.exit(1)
    
    # Check for markdown files
    md_files = list(input_path.glob("**/*.md"))
    if not md_files:
        print(f"Warning: No .md files found in '{input_dir}'.", file=sys.stderr)
        sys.exit(1)
    
    print(f"Found {len(md_files)} markdown file(s) in '{input_dir}'")
    
    # Initialize the embedding model
    print(f"Loading embedding model: {embed_model_name}...")
    embed_model = HuggingFaceEmbedding(model_name=embed_model_name)
    
    # Test the model
    test_embeddings = embed_model.get_text_embedding("test")
    print(f"Embedding dimension: {len(test_embeddings)}")
    
    if len(test_embeddings) != embed_dim:
        print(f"Warning: Expected embedding dimension {embed_dim}, got {len(test_embeddings)}")
        embed_dim = len(test_embeddings)
    
    # Load documents from the input directory
    print(f"Loading documents from '{input_dir}'...")
    documents = SimpleDirectoryReader(
        input_dir=str(input_path),
        required_exts=[".md"],
        recursive=True,
    ).load_data()
    
    print(f"Loaded {len(documents)} document(s)")
    
    # Configure global settings with chunking strategy
    Settings.embed_model = embed_model
    Settings.chunk_size = chunk_size
    
    # Set up DuckDB vector store
    output_path = Path(output_db)
    persist_dir = output_path.parent if output_path.parent.exists() else Path(".")
    database_name = output_path.stem
    
    print(f"Creating DuckDB vector store: {persist_dir}/{database_name}.duckdb")
    
    vector_store = DuckDBVectorStore(
        database_name=database_name,
        persist_dir=str(persist_dir),
        embed_dim=embed_dim,
    )
    
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    
    # Create the knowledge base by generating and storing embeddings
    print("Generating embeddings and building knowledge base...")
    print("(This may take a while depending on the number and size of documents)")
    
    knowledge_base = VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
        show_progress=True,
    )
    
    print(f"\n✓ Knowledge base created successfully!")
    print(f"✓ Database saved to: {persist_dir}/{database_name}.duckdb")
    print(f"✓ Total chunks processed: {len(documents)}")
    print(f"\nYou can now use this database for RAG applications.")


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Prepare embeddings from markdown files and store in DuckDB",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage - process docs folder and create knowledge_base.duckdb
  %(prog)s docs -o knowledge_base.duckdb
  
  # Use custom chunk size
  %(prog)s docs -o kb.duckdb --chunk-size 256
  
  # Use a different embedding model
  %(prog)s docs -o kb.duckdb --model "sentence-transformers/all-MiniLM-L6-v2" --embed-dim 384
        """,
    )
    
    parser.add_argument(
        "input_dir",
        help="Directory containing markdown (.md) files to process",
    )
    
    parser.add_argument(
        "-o",
        "--output",
        dest="output_db",
        default="knowledge_base.duckdb",
        help="Output DuckDB database file path (default: knowledge_base.duckdb)",
    )
    
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=512,
        help="Size of text chunks in tokens (default: 512)",
    )
    
    parser.add_argument(
        "--model",
        dest="embed_model_name",
        default="BAAI/bge-small-en-v1.5",
        help="HuggingFace embedding model name (default: BAAI/bge-small-en-v1.5)",
    )
    
    parser.add_argument(
        "--embed-dim",
        type=int,
        default=384,
        help="Embedding dimension size (default: 384 for bge-small-en-v1.5)",
    )
    
    args = parser.parse_args()
    
    try:
        prepare_embeddings(
            input_dir=args.input_dir,
            output_db=args.output_db,
            chunk_size=args.chunk_size,
            embed_model_name=args.embed_model_name,
            embed_dim=args.embed_dim,
        )
    except KeyboardInterrupt:
        print("\n\nInterrupted by user.", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

