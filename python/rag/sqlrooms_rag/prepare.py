"""
Core functionality for preparing embeddings from markdown files.
"""

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
    verbose: bool = True,
):
    """
    Prepare embeddings from markdown files and store in DuckDB.

    Args:
        input_dir: Directory containing .md files to process
        output_db: Path to output DuckDB database file (without extension)
        chunk_size: Size of text chunks in tokens (default: 512)
        embed_model_name: HuggingFace model name (default: BAAI/bge-small-en-v1.5)
        embed_dim: Embedding dimension size (default: 384 for bge-small)
        verbose: Whether to print progress messages (default: True)
    
    Returns:
        VectorStoreIndex: The created knowledge base index
    
    Raises:
        FileNotFoundError: If input directory doesn't exist
        ValueError: If no markdown files found in input directory
    """
    input_path = Path(input_dir)
    
    # Validate input directory
    if not input_path.exists():
        raise FileNotFoundError(f"Input directory '{input_dir}' does not exist.")
    
    if not input_path.is_dir():
        raise ValueError(f"'{input_dir}' is not a directory.")
    
    # Check for markdown files
    md_files = list(input_path.glob("**/*.md"))
    if not md_files:
        raise ValueError(f"No .md files found in '{input_dir}'.")
    
    if verbose:
        print(f"Found {len(md_files)} markdown file(s) in '{input_dir}'")
    
    # Initialize the embedding model
    if verbose:
        print(f"Loading embedding model: {embed_model_name}...")
    embed_model = HuggingFaceEmbedding(model_name=embed_model_name)
    
    # Test the model
    test_embeddings = embed_model.get_text_embedding("test")
    actual_dim = len(test_embeddings)
    
    if verbose:
        print(f"Embedding dimension: {actual_dim}")
    
    if actual_dim != embed_dim:
        if verbose:
            print(f"Warning: Expected embedding dimension {embed_dim}, got {actual_dim}")
        embed_dim = actual_dim
    
    # Load documents from the input directory
    if verbose:
        print(f"Loading documents from '{input_dir}'...")
    documents = SimpleDirectoryReader(
        input_dir=str(input_path),
        required_exts=[".md"],
        recursive=True,
    ).load_data()
    
    if verbose:
        print(f"Loaded {len(documents)} document(s)")
    
    # Configure global settings with chunking strategy
    Settings.embed_model = embed_model
    Settings.chunk_size = chunk_size
    
    # Set up DuckDB vector store
    output_path = Path(output_db)
    
    # Handle directory and database name
    # DuckDB doesn't automatically add .duckdb extension, so we handle it explicitly
    if output_path.suffix == '.duckdb':
        # User provided full path with .duckdb extension
        persist_dir = output_path.parent if output_path.parent != Path('.') else Path(".")
        database_name = output_path.name  # Keep full name with .duckdb
    else:
        # User provided path without extension - add .duckdb
        persist_dir = output_path.parent if output_path.parent != Path('.') else Path(".")
        database_name = output_path.name + '.duckdb'
    
    # Ensure persist_dir exists
    if persist_dir != Path("."):
        persist_dir.mkdir(parents=True, exist_ok=True)
    
    if verbose:
        print(f"Creating DuckDB vector store: {persist_dir}/{database_name}")
    
    vector_store = DuckDBVectorStore(
        database_name=database_name,
        persist_dir=str(persist_dir),
        embed_dim=embed_dim,
    )
    
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    
    # Create the knowledge base by generating and storing embeddings
    if verbose:
        print("Generating embeddings and building knowledge base...")
        print("(This may take a while depending on the number and size of documents)")
    
    knowledge_base = VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
        show_progress=verbose,
    )
    
    if verbose:
        print(f"\n✓ Knowledge base created successfully!")
        print(f"✓ Database saved to: {persist_dir}/{database_name}")
        print(f"✓ Total chunks processed: {len(documents)}")
        print(f"\nYou can now use this database for RAG applications.")
    
    return knowledge_base

