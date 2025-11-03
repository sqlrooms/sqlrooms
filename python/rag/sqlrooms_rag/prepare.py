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
from llama_index.core.node_parser import MarkdownNodeParser
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.duckdb import DuckDBVectorStore


def prepare_embeddings(
    input_dir: str,
    output_db: str,
    chunk_size: int = 512,
    embed_model_name: str = "BAAI/bge-small-en-v1.5",
    embed_dim: int = 384,
    verbose: bool = True,
    use_markdown_chunking: bool = True,
    include_headers_in_chunks: bool = True,
    header_weight: int = 3,
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
        use_markdown_chunking: Use markdown-aware chunking by headers (default: True)
        include_headers_in_chunks: Prepend headers to chunk text for higher weight (default: True)
        header_weight: Number of times to repeat headers in chunks (default: 3, min: 1)
    
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
    
    # Configure global settings
    Settings.embed_model = embed_model
    Settings.chunk_size = chunk_size
    
    # Parse documents into nodes using markdown-aware chunking
    if use_markdown_chunking:
        if verbose:
            print("Using markdown-aware chunking (splits by headers and sections)...")
        
        # Create markdown parser that respects document structure
        # include_metadata=True stores headers in metadata
        # include_prev_next_rel=True adds context about surrounding chunks
        markdown_parser = MarkdownNodeParser(
            include_metadata=True,
            include_prev_next_rel=True,
        )
        nodes = markdown_parser.get_nodes_from_documents(documents)
        
        # Prepend header hierarchy to each chunk to give headers more weight
        if include_headers_in_chunks:
            # Ensure header_weight is at least 1
            weight = max(1, header_weight)
            headers_added = 0
            
            for node in nodes:
                # Get header from metadata if available
                header_text = ""
                if hasattr(node, 'metadata') and node.metadata:
                    # Common metadata fields that might contain headers
                    if 'header_path' in node.metadata:
                        header_text = node.metadata['header_path']
                    elif 'section_header' in node.metadata:
                        header_text = node.metadata['section_header']
                
                # Repeat header multiple times to increase its weight in embeddings
                if header_text and not node.text.startswith(header_text):
                    # Repeat the header 'weight' times, separated by newlines
                    repeated_header = "\n".join([header_text] * weight) + "\n\n"
                    node.text = repeated_header + node.text
                    headers_added += 1
            
            if verbose and headers_added > 0:
                weight_msg = f" (weight: {weight}x)" if weight > 1 else ""
                print(f"Enhanced {headers_added} chunks with header context{weight_msg} for better retrieval")
        
        if verbose:
            print(f"Created {len(nodes)} chunks from markdown sections")
    else:
        if verbose:
            print("Using default size-based chunking...")
        nodes = None  # Let VectorStoreIndex do default chunking
    
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
    
    if nodes:
        # Use pre-parsed nodes
        knowledge_base = VectorStoreIndex(
            nodes,
            storage_context=storage_context,
            show_progress=verbose,
        )
    else:
        # Use default document parsing
        knowledge_base = VectorStoreIndex.from_documents(
            documents,
            storage_context=storage_context,
            show_progress=verbose,
        )
    
    if verbose:
        print(f"\n✓ Knowledge base created successfully!")
        print(f"✓ Database saved to: {persist_dir}/{database_name}")
        if nodes:
            print(f"✓ Total chunks processed: {len(nodes)} (from {len(documents)} documents)")
        else:
            print(f"✓ Total documents processed: {len(documents)}")
        print(f"\nYou can now use this database for RAG applications.")
    
    return knowledge_base

