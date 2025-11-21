"""
Core functionality for preparing embeddings from markdown files.
"""

import sys
import json
import os
import yaml
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Literal, Dict, Any

import duckdb
from llama_index.core import (
    StorageContext,
    VectorStoreIndex,
    SimpleDirectoryReader,
    Settings,
)
from llama_index.core.node_parser import MarkdownNodeParser
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.duckdb import DuckDBVectorStore


def _count_tokens(text: str) -> int:
    """
    Estimate token count for text.
    
    Uses a conservative approximation: ~3 characters per token.
    This overestimates slightly to ensure we stay well under API limits.
    
    For technical text with code, markdown, and special characters,
    the actual token count can be higher than the 4 char/token rule.
    
    Args:
        text: Text to count tokens for
    
    Returns:
        Estimated token count (conservative/higher estimate)
    """
    # Use 3 chars per token for conservative estimate
    # Technical text often has more tokens per character
    return len(text) // 3


def _validate_and_split_chunks(
    nodes: list,
    max_tokens: int = 5000,
    verbose: bool = True
) -> list:
    """
    Validate chunk sizes and split any that exceed token limits.
    
    This is important for external APIs (like OpenAI) that have strict
    token limits per request (8192 tokens). We use 5000 for safety:
    - Conservative token estimation (3 chars/token, not perfect)
    - Header weighting already applied to text
    - Technical content (code, tables) has higher token density
    - Better safe than sorry - splitting works fine
    - Large margin accounts for estimation errors
    
    Why chunks can be large:
    - Markdown-aware chunking respects document structure
    - Some documents have huge sections (tables, code)
    - Header weighting multiplies the text (2x-3x)
    
    Args:
        nodes: List of llama-index Node objects
        max_tokens: Maximum tokens per chunk (default: 5000, well under OpenAI's 8192 limit)
        verbose: Whether to print progress messages
    
    Returns:
        List of validated nodes (may include split chunks)
    """
    validated_nodes = []
    oversized_count = 0
    split_count = 0
    
    for node in nodes:
        text = node.text if hasattr(node, 'text') else str(node)
        token_count = _count_tokens(text)
        
        if token_count <= max_tokens:
            # Chunk is fine, keep as-is
            validated_nodes.append(node)
        else:
            # Chunk is too large, need to split
            oversized_count += 1
            
            # Split by sentences to try to maintain coherence
            sentences = text.split('. ')
            current_chunk = []
            current_tokens = 0
            
            for sentence in sentences:
                sentence_tokens = _count_tokens(sentence)
                
                # If single sentence is too large, split it by character count
                if sentence_tokens > max_tokens:
                    # Split this sentence into smaller pieces
                    # Use very conservative char count (2 chars/token for safety)
                    chunk_size_chars = max_tokens * 2
                    for i in range(0, len(sentence), chunk_size_chars):
                        piece = sentence[i:i + chunk_size_chars]
                        
                        # Double-check the piece isn't still too large
                        if _count_tokens(piece) > max_tokens:
                            # If still too large, split even smaller (1 char/token!)
                            smaller_chunk_size = max_tokens
                            for j in range(0, len(piece), smaller_chunk_size):
                                tiny_piece = piece[j:j + smaller_chunk_size]
                                from copy import deepcopy
                                new_node = deepcopy(node)
                                new_node.text = tiny_piece
                                # Generate new unique ID for split chunk
                                new_node.node_id = str(uuid.uuid4())
                                validated_nodes.append(new_node)
                                split_count += 1
                        else:
                            # Create new node with same metadata
                            from copy import deepcopy
                            new_node = deepcopy(node)
                            new_node.text = piece
                            # Generate new unique ID for split chunk
                            new_node.node_id = str(uuid.uuid4())
                            validated_nodes.append(new_node)
                            split_count += 1
                    continue
                
                # Check if adding this sentence would exceed limit
                if current_tokens + sentence_tokens > max_tokens and current_chunk:
                    # Save current chunk
                    from copy import deepcopy
                    new_node = deepcopy(node)
                    new_node.text = '. '.join(current_chunk) + '.'
                    # Generate new unique ID for split chunk
                    new_node.node_id = str(uuid.uuid4())
                    validated_nodes.append(new_node)
                    split_count += 1
                    
                    # Start new chunk
                    current_chunk = [sentence]
                    current_tokens = sentence_tokens
                else:
                    # Add sentence to current chunk
                    current_chunk.append(sentence)
                    current_tokens += sentence_tokens
            
            # Don't forget the last chunk
            if current_chunk:
                from copy import deepcopy
                new_node = deepcopy(node)
                new_node.text = '. '.join(current_chunk)
                if not current_chunk[-1].endswith('.'):
                    new_node.text += '.'
                # Generate new unique ID for split chunk
                new_node.node_id = str(uuid.uuid4())
                validated_nodes.append(new_node)
                split_count += 1
    
    if verbose and oversized_count > 0:
        print(f"⚠ Found {oversized_count} oversized chunks (>{max_tokens} tokens)")
        print(f"✓ Split into {split_count} smaller chunks")
        print(f"✓ Total chunks: {len(validated_nodes)} (was {len(nodes)})")
    
    # Final safety check: verify no chunks exceed limit
    final_oversized = [
        (i, node, _count_tokens(node.text if hasattr(node, 'text') else str(node)))
        for i, node in enumerate(validated_nodes)
        if _count_tokens(node.text if hasattr(node, 'text') else str(node)) > max_tokens
    ]
    
    if final_oversized:
        if verbose:
            print(f"⚠ WARNING: {len(final_oversized)} chunks still exceed {max_tokens} tokens after splitting!")
            for i, node, tokens in final_oversized[:3]:  # Show first 3
                text_preview = (node.text if hasattr(node, 'text') else str(node))[:100]
                print(f"  Chunk {i}: {tokens} tokens - '{text_preview}...'")
            if len(final_oversized) > 3:
                print(f"  ... and {len(final_oversized) - 3} more")
            print(f"\nThese will likely cause API errors. Consider:")
            print(f"  1. Using --chunk-size 256 or smaller")
            print(f"  2. Using --header-weight 1 or --no-header-weighting")
            print(f"  3. Preprocessing very large markdown sections")
    
    return validated_nodes


def _get_embedding_model(
    provider: Literal["huggingface", "openai"] = "huggingface",
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    embed_dim: Optional[int] = None,
    verbose: bool = True
):
    """
    Get an embedding model based on the provider.
    
    Args:
        provider: Either "huggingface" (local) or "openai" (API)
        model_name: Model name/identifier. Defaults depend on provider:
            - huggingface: "BAAI/bge-small-en-v1.5"
            - openai: "text-embedding-3-small"
        api_key: API key for external providers (required for OpenAI).
            If not provided, will look for OPENAI_API_KEY environment variable.
        embed_dim: Expected embedding dimension. If None, will be auto-detected.
        verbose: Whether to print progress messages
    
    Returns:
        Tuple of (embed_model, actual_embed_dim)
    
    Raises:
        ValueError: If API key is required but not provided
        ImportError: If required package is not installed
    """
    if provider == "huggingface":
        # Local HuggingFace embeddings (default)
        if model_name is None:
            model_name = "BAAI/bge-small-en-v1.5"
        
        if verbose:
            print(f"Loading HuggingFace embedding model: {model_name}...")
        
        embed_model = HuggingFaceEmbedding(model_name=model_name)
        
        # Test to get actual dimension
        test_embeddings = embed_model.get_text_embedding("test")
        actual_dim = len(test_embeddings)
        
        if verbose:
            print(f"Embedding dimension: {actual_dim}")
        
        if embed_dim and actual_dim != embed_dim:
            if verbose:
                print(f"Warning: Expected dimension {embed_dim}, got {actual_dim}")
        
        return embed_model, actual_dim
    
    elif provider == "openai":
        # OpenAI API embeddings
        try:
            from llama_index.embeddings.openai import OpenAIEmbedding
        except ImportError:
            raise ImportError(
                "OpenAI embeddings require 'llama-index-embeddings-openai'. "
                "Install with: pip install llama-index-embeddings-openai"
            )
        
        # Get API key
        if api_key is None:
            api_key = os.environ.get("OPENAI_API_KEY")
        
        if not api_key:
            raise ValueError(
                "OpenAI API key required. Provide via api_key parameter or "
                "set OPENAI_API_KEY environment variable."
            )
        
        # Set default model if not specified
        if model_name is None:
            model_name = "text-embedding-3-small"
        
        if verbose:
            print(f"Using OpenAI embedding model: {model_name}...")
        
        # Determine embedding dimension based on model
        dimension_map = {
            "text-embedding-3-small": 1536,
            "text-embedding-3-large": 3072,
            "text-embedding-ada-002": 1536,
        }
        
        if embed_dim is None:
            embed_dim = dimension_map.get(model_name, 1536)
        
        embed_model = OpenAIEmbedding(
            model=model_name,
            api_key=api_key,
            dimensions=embed_dim if "text-embedding-3" in model_name else None
        )
        
        if verbose:
            print(f"Embedding dimension: {embed_dim}")
            print("Note: Using OpenAI API will incur costs per token")
        
        return embed_model, embed_dim
    
    else:
        raise ValueError(
            f"Unknown provider: {provider}. "
            f"Supported providers: 'huggingface', 'openai'"
        )


def _create_source_documents_table(
    db_path: Path,
    documents: list,
    verbose: bool = True
) -> None:
    """
    Create a table storing original source documents before chunking.
    
    This allows retrieving full document context after finding relevant chunks.
    Each chunk in the main documents table will reference its source document.
    
    Args:
        db_path: Full path to the DuckDB database file
        documents: List of llama-index Document objects
        verbose: Whether to print progress messages
    """
    if verbose:
        print("Creating source documents table...")
    
    conn = duckdb.connect(str(db_path))
    
    try:
        # Create table for original source documents
        conn.execute("""
            CREATE TABLE IF NOT EXISTS source_documents (
                doc_id VARCHAR PRIMARY KEY,
                file_path VARCHAR,
                file_name VARCHAR,
                text TEXT,
                metadata_ JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert source documents
        for doc in documents:
            # Extract metadata
            metadata = doc.metadata if hasattr(doc, 'metadata') else {}
            doc_id = doc.doc_id if hasattr(doc, 'doc_id') else str(hash(doc.text))
            file_path = metadata.get('file_path', '')
            file_name = metadata.get('file_name', '')
            
            conn.execute("""
                INSERT INTO source_documents (doc_id, file_path, file_name, text, metadata_)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (doc_id) DO UPDATE SET
                    text = EXCLUDED.text,
                    metadata_ = EXCLUDED.metadata_
            """, [doc_id, file_path, file_name, doc.text, json.dumps(metadata)])
        
        if verbose:
            count = conn.execute("SELECT COUNT(*) FROM source_documents").fetchone()[0]
            print(f"✓ Stored {count} source documents")
            
    finally:
        conn.close()


def _add_document_references(
    db_path: Path,
    nodes: list,
    verbose: bool = True
) -> None:
    """
    Add source document references to chunk nodes.
    
    Updates the documents table to add doc_id column linking chunks
    to their source documents.
    
    Args:
        db_path: Full path to the DuckDB database file
        nodes: List of llama-index Node objects (chunks)
        verbose: Whether to print progress messages
    """
    if verbose:
        print("Adding source document references to chunks...")
    
    conn = duckdb.connect(str(db_path))
    
    try:
        # Add doc_id column if it doesn't exist
        try:
            conn.execute("""
                ALTER TABLE documents 
                ADD COLUMN doc_id VARCHAR
            """)
        except:
            # Column might already exist
            pass
        
        # Update chunks with their source document IDs
        for node in nodes:
            if hasattr(node, 'node_id') and hasattr(node, 'ref_doc_id'):
                conn.execute("""
                    UPDATE documents 
                    SET doc_id = ?
                    WHERE node_id = ?
                """, [node.ref_doc_id, node.node_id])
        
        if verbose:
            count = conn.execute(
                "SELECT COUNT(*) FROM documents WHERE doc_id IS NOT NULL"
            ).fetchone()[0]
            print(f"✓ Linked {count} chunks to source documents")
            
    finally:
        conn.close()


def _calculate_chunk_stats(nodes: list) -> Dict[str, Any]:
    """
    Calculate statistics about the chunks.
    
    Args:
        nodes: List of llama-index Node objects
    
    Returns:
        Dictionary with chunk statistics
    """
    if not nodes:
        return {
            'total_chunks': 0,
            'min_chunk_size': 0,
            'max_chunk_size': 0,
            'median_chunk_size': 0,
            'mean_chunk_size': 0,
            'total_characters': 0,
        }
    
    # Get chunk sizes
    chunk_sizes = [len(node.text) if hasattr(node, 'text') else 0 for node in nodes]
    chunk_sizes.sort()
    
    return {
        'total_chunks': len(nodes),
        'min_chunk_size': min(chunk_sizes),
        'max_chunk_size': max(chunk_sizes),
        'median_chunk_size': chunk_sizes[len(chunk_sizes) // 2],
        'mean_chunk_size': sum(chunk_sizes) // len(chunk_sizes),
        'total_characters': sum(chunk_sizes),
    }


def _create_metadata(
    documents: list,
    nodes: list,
    embedding_provider: str,
    embed_model_name: str,
    embed_dim: int,
    chunk_size: int,
    use_markdown_chunking: bool,
    include_headers_in_chunks: bool,
    header_weight: int,
) -> Dict[str, Any]:
    """
    Create comprehensive metadata about the embedding preparation.
    
    This metadata is crucial for:
    - Ensuring query-time uses the same model
    - Debugging and reproducibility
    - Understanding the dataset
    - Version compatibility
    
    Args:
        documents: List of source documents
        nodes: List of chunk nodes
        embedding_provider: Provider used (huggingface/openai)
        embed_model_name: Name of embedding model
        embed_dim: Embedding dimension
        chunk_size: Configured chunk size
        use_markdown_chunking: Whether markdown-aware chunking was used
        include_headers_in_chunks: Whether headers were included
        header_weight: Header repetition weight
    
    Returns:
        Dictionary with comprehensive metadata
    """
    chunk_stats = _calculate_chunk_stats(nodes)
    
    # Count unique source files
    unique_files = set()
    for doc in documents:
        if hasattr(doc, 'metadata') and doc.metadata:
            file_path = doc.metadata.get('file_path', '')
            if file_path:
                unique_files.add(file_path)
    
    metadata = {
        'version': '1.0',
        'created_at': datetime.utcnow().isoformat() + 'Z',
        'embedding': {
            'provider': embedding_provider,
            'model': embed_model_name,
            'dimensions': embed_dim,
        },
        'chunking': {
            'strategy': 'markdown-aware' if use_markdown_chunking else 'size-based',
            'chunk_size': chunk_size,
            'include_headers': include_headers_in_chunks,
            'header_weight': header_weight if include_headers_in_chunks else 0,
        },
        'source_documents': {
            'total_documents': len(documents),
            'unique_files': len(unique_files),
            'total_characters': sum(len(doc.text) for doc in documents if hasattr(doc, 'text')),
        },
        'chunks': chunk_stats,
        'capabilities': {
            'hybrid_search': True,
            'fts_enabled': True,
            'source_documents_stored': True,
        }
    }
    
    return metadata


def _store_metadata_in_db(db_path: Path, metadata: Dict[str, Any], verbose: bool = True) -> None:
    """
    Store metadata in the DuckDB database for runtime access.
    
    Creates a 'metadata' table with key-value pairs that can be queried
    at runtime to validate model compatibility.
    
    Args:
        db_path: Full path to the DuckDB database file
        metadata: Metadata dictionary
        verbose: Whether to print progress messages
    """
    if verbose:
        print("Storing metadata in database...")
    
    conn = duckdb.connect(str(db_path))
    
    try:
        # Create metadata table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS embedding_metadata (
                key VARCHAR PRIMARY KEY,
                value VARCHAR,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Flatten metadata for storage
        flat_metadata = {
            'version': metadata['version'],
            'created_at': metadata['created_at'],
            # Embedding info
            'embedding_provider': metadata['embedding']['provider'],
            'embedding_model': metadata['embedding']['model'],
            'embedding_dimensions': str(metadata['embedding']['dimensions']),
            # Chunking info
            'chunking_strategy': metadata['chunking']['strategy'],
            'chunk_size': str(metadata['chunking']['chunk_size']),
            'include_headers': str(metadata['chunking']['include_headers']),
            'header_weight': str(metadata['chunking']['header_weight']),
            # Document stats
            'total_source_documents': str(metadata['source_documents']['total_documents']),
            'unique_files': str(metadata['source_documents']['unique_files']),
            'source_total_characters': str(metadata['source_documents']['total_characters']),
            # Chunk stats
            'total_chunks': str(metadata['chunks']['total_chunks']),
            'min_chunk_size': str(metadata['chunks']['min_chunk_size']),
            'max_chunk_size': str(metadata['chunks']['max_chunk_size']),
            'median_chunk_size': str(metadata['chunks']['median_chunk_size']),
            'mean_chunk_size': str(metadata['chunks']['mean_chunk_size']),
            'chunks_total_characters': str(metadata['chunks']['total_characters']),
            # Capabilities
            'hybrid_search_enabled': str(metadata['capabilities']['hybrid_search']),
            'fts_enabled': str(metadata['capabilities']['fts_enabled']),
            'source_documents_stored': str(metadata['capabilities']['source_documents_stored']),
        }
        
        # Insert/update metadata
        for key, value in flat_metadata.items():
            conn.execute("""
                INSERT INTO embedding_metadata (key, value)
                VALUES (?, ?)
                ON CONFLICT (key) DO UPDATE SET
                    value = EXCLUDED.value
            """, [key, value])
        
        if verbose:
            print(f"✓ Stored {len(flat_metadata)} metadata entries in database")
            
    finally:
        conn.close()


def _save_metadata_yaml(db_path: Path, metadata: Dict[str, Any], verbose: bool = True) -> None:
    """
    Save metadata as a YAML file next to the database.
    
    This provides human-readable documentation and makes it easy to
    check settings without opening the database.
    
    Args:
        db_path: Full path to the DuckDB database file
        metadata: Metadata dictionary
        verbose: Whether to print progress messages
    """
    # Determine YAML file path (same location as .duckdb, but .yaml extension)
    yaml_path = db_path.with_suffix('.yaml')
    
    if verbose:
        print(f"Saving metadata to {yaml_path.name}...")
    
    try:
        with open(yaml_path, 'w') as f:
            yaml.dump(metadata, f, default_flow_style=False, sort_keys=False)
        
        if verbose:
            print(f"✓ Metadata saved to {yaml_path}")
            
    except Exception as e:
        if verbose:
            print(f"Warning: Could not save YAML metadata: {e}")


def _create_fts_index(db_path: Path, verbose: bool = True) -> None:
    """
    Create full-text search index on the documents table.
    
    This enables hybrid retrieval combining vector similarity with keyword search.
    The FTS index is created on the chunked text for fast keyword matching.
    
    Args:
        db_path: Full path to the DuckDB database file
        verbose: Whether to print progress messages
    """
    if verbose:
        print("Creating full-text search index...")
    
    conn = duckdb.connect(str(db_path))
    
    try:
        # Load FTS extension
        conn.execute("INSTALL fts;")
        conn.execute("LOAD fts;")
        
        # Create FTS index
        conn.execute("""
            PRAGMA create_fts_index(
                'documents',
                'node_id',
                'text',
                stemmer = 'porter',
                stopwords = 'english',
                ignore = '(\\.|[^a-z])+',
                strip_accents = 1,
                lower = 1,
                overwrite = 1
            )
        """)
        
        if verbose:
            print("✓ Full-text search index created")
            
    except Exception as e:
        if verbose:
            print(f"Warning: Could not create FTS index: {e}")
            print("Hybrid search will not be available.")
    finally:
        conn.close()


def prepare_embeddings(
    input_dir: str,
    output_db: str,
    chunk_size: int = 512,
    embed_model_name: Optional[str] = None,
    embed_dim: Optional[int] = None,
    embedding_provider: Literal["huggingface", "openai"] = "huggingface",
    api_key: Optional[str] = None,
    verbose: bool = True,
    use_markdown_chunking: bool = True,
    include_headers_in_chunks: bool = True,
    header_weight: int = 3,
    overwrite: bool = False,
):
    """
    Prepare embeddings from markdown files and store in DuckDB.

    Args:
        input_dir: Directory containing .md files to process
        output_db: Path to output DuckDB database file (without extension)
        chunk_size: Size of text chunks in tokens (default: 512)
        embed_model_name: Model name. Defaults depend on provider:
            - huggingface: "BAAI/bge-small-en-v1.5"
            - openai: "text-embedding-3-small"
        embed_dim: Embedding dimension. If None, auto-detected from model.
            Common values:
            - BAAI/bge-small-en-v1.5: 384
            - text-embedding-3-small: 1536
            - text-embedding-3-large: 3072
        embedding_provider: "huggingface" (local, free) or "openai" (API, paid)
        api_key: API key for external providers (required for OpenAI).
            Can also be set via OPENAI_API_KEY environment variable.
        verbose: Whether to print progress messages (default: True)
        use_markdown_chunking: Use markdown-aware chunking by headers (default: True)
        include_headers_in_chunks: Prepend headers to chunk text for higher weight (default: True)
        header_weight: Number of times to repeat headers in chunks (default: 3, min: 1)
        overwrite: If True, overwrite existing database. If False, exit with error if database exists. (default: False)
    
    Returns:
        VectorStoreIndex: The created knowledge base index
    
    Raises:
        FileNotFoundError: If input directory doesn't exist
        FileExistsError: If database exists and overwrite=False
        ValueError: If no markdown files found in input directory or API key missing
        ImportError: If required package for provider is not installed
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
    
    # Check if output database already exists BEFORE doing any expensive work
    output_path = Path(output_db)
    if output_path.suffix == '.duckdb':
        full_db_path = output_path
    else:
        full_db_path = Path(str(output_path) + '.duckdb')
    
    if full_db_path.exists():
        if not overwrite:
            raise FileExistsError(
                f"Database already exists: {full_db_path}\n"
                f"Use --overwrite flag to replace it, or choose a different output path."
            )
        if verbose:
            print(f"⚠ Will overwrite existing database: {full_db_path}")
    
    # Initialize the embedding model
    embed_model, embed_dim = _get_embedding_model(
        provider=embedding_provider,
        model_name=embed_model_name,
        api_key=api_key,
        embed_dim=embed_dim,
        verbose=verbose
    )
    
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
    
    # Note about OpenAI limits
    if embedding_provider == "openai" and verbose:
        print(f"Using chunk_size={chunk_size} (OpenAI limit: 8192 tokens per request)")
        print(f"Oversized chunks will be automatically split if needed")
    
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
        
        # For external APIs: validate and split oversized chunks
        # OpenAI has 8192 token limit, we use 5000 for extra safety
        # (token estimation isn't perfect, better safe than sorry)
        if embedding_provider == "openai":
            if verbose:
                print("Validating chunk sizes for OpenAI (API limit: 8192 tokens)...")
            nodes = _validate_and_split_chunks(nodes, max_tokens=5000, verbose=verbose)
        
        # Prepend header hierarchy to each chunk to give headers more weight
        if include_headers_in_chunks:
            # Ensure header_weight is at least 1
            weight = max(1, header_weight)
            
            # Warn about high header weights with external APIs
            if embedding_provider == "openai" and weight > 2 and verbose:
                print(f"Warning: header_weight={weight} may create large chunks")
                print(f"         (chunks will be auto-split if they exceed OpenAI's 8192 token limit)")
            
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
    
    # Delete existing database if overwrite=True (we already checked existence earlier)
    full_db_path = persist_dir / database_name if persist_dir != Path(".") else Path(database_name)
    if overwrite and full_db_path.exists():
        if verbose:
            print(f"Removing existing database: {full_db_path}")
        full_db_path.unlink()
    
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
        if nodes:
            num_chunks = len(nodes)
            num_batches = (num_chunks + 2047) // 2048  # Calculate number of 2048-sized batches
            print(f"Processing {num_chunks} chunks in {num_batches} batch(es) of up to 2048 chunks each")
            if num_batches > 1:
                print("(Progress bar will reset for each batch)")
        print("(This may take a while depending on the number and size of documents)")
    
    try:
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
    except Exception as e:
        error_msg = str(e)
        
        # Check if this is a token limit error
        if "maximum context length" in error_msg.lower() and "tokens" in error_msg.lower():
            print("\n" + "=" * 80)
            print("ERROR: OpenAI Token Limit Exceeded")
            print("=" * 80)
            print(f"\n{error_msg}\n")
            
            # Try to find the problematic chunk(s)
            print("Analyzing chunks to find the problematic one(s)...\n")
            
            if nodes:
                oversized = []
                for i, node in enumerate(nodes):
                    text = node.text if hasattr(node, 'text') else str(node)
                    tokens = _count_tokens(text)
                    # Check against a conservative threshold
                    if tokens > 5000:
                        oversized.append((i, node, text, tokens))
                
                if oversized:
                    print(f"Found {len(oversized)} chunk(s) that may be too large:\n")
                    for idx, (i, node, text, tokens) in enumerate(oversized[:5], 1):  # Show first 5
                        print(f"\nProblematic Chunk #{idx}:")
                        print(f"  Index: {i}")
                        print(f"  Estimated tokens: {tokens}")
                        print(f"  Character length: {len(text)}")
                        
                        # Show metadata
                        if hasattr(node, 'metadata') and node.metadata:
                            print(f"  Metadata: {node.metadata}")
                        
                        # Show text preview
                        print(f"  Text preview (first 500 chars):")
                        print(f"  {'-' * 76}")
                        print(f"  {text[:500]}")
                        print(f"  {'-' * 76}")
                        
                        # Show text end
                        if len(text) > 500:
                            print(f"  ... ({len(text) - 1000} chars omitted) ...")
                            print(f"  Text preview (last 500 chars):")
                            print(f"  {'-' * 76}")
                            print(f"  {text[-500:]}")
                            print(f"  {'-' * 76}")
                        
                        # Save full chunk to file for inspection
                        problem_file = full_db_path.parent / f"problem_chunk_{i}.txt"
                        try:
                            with open(problem_file, 'w') as f:
                                f.write(f"Chunk Index: {i}\n")
                                f.write(f"Estimated Tokens: {tokens}\n")
                                f.write(f"Character Length: {len(text)}\n")
                                f.write(f"Metadata: {node.metadata if hasattr(node, 'metadata') else 'None'}\n")
                                f.write(f"\n{'=' * 80}\n")
                                f.write(f"FULL TEXT:\n")
                                f.write(f"{'=' * 80}\n\n")
                                f.write(text)
                            print(f"\n  ✓ Full chunk saved to: {problem_file}")
                        except Exception as save_error:
                            print(f"\n  ✗ Could not save chunk: {save_error}")
                    
                    if len(oversized) > 5:
                        print(f"\n... and {len(oversized) - 5} more oversized chunks")
                    
                    print("\n" + "=" * 80)
                    print("SOLUTIONS:")
                    print("=" * 80)
                    print("\nThe splitting logic couldn't break these chunks down enough.")
                    print("This usually happens with:")
                    print("  - Very long tables")
                    print("  - Large code blocks")
                    print("  - Continuous text without sentence breaks")
                    print("\nTry these solutions:")
                    print("\n1. Use even smaller chunk size:")
                    print("   --chunk-size 64")
                    print("\n2. Disable markdown chunking (use size-based):")
                    print("   --chunk-size 256 --no-markdown-chunking")
                    print("\n3. Preprocess the source markdown files:")
                    print("   - Break up very long tables")
                    print("   - Split large code blocks")
                    print("   - Add section breaks in continuous text")
                    print("\n4. Manual inspection:")
                    print("   - Check the saved problem_chunk_*.txt files")
                    print("   - Identify the source document")
                    print("   - Edit or exclude that document")
                    print()
                else:
                    print("Could not identify oversized chunks (they may have been missed by validation)")
            
            raise
        else:
            # Different error, re-raise with original traceback
            raise
    
    # Get the full database path
    full_db_path = persist_dir / database_name if persist_dir != Path(".") else Path(database_name)
    
    # Store original source documents
    _create_source_documents_table(
        db_path=full_db_path,
        documents=documents,
        verbose=verbose
    )
    
    # Link chunks to source documents
    if nodes:
        _add_document_references(
            db_path=full_db_path,
            nodes=nodes,
            verbose=verbose
        )
    
    # Create full-text search index for hybrid retrieval
    _create_fts_index(
        db_path=full_db_path,
        verbose=verbose
    )
    
    # Create and store metadata
    metadata = _create_metadata(
        documents=documents,
        nodes=nodes if nodes else [],
        embedding_provider=embedding_provider,
        embed_model_name=embed_model_name if embed_model_name else (
            "BAAI/bge-small-en-v1.5" if embedding_provider == "huggingface" 
            else "text-embedding-3-small"
        ),
        embed_dim=embed_dim,
        chunk_size=chunk_size,
        use_markdown_chunking=use_markdown_chunking,
        include_headers_in_chunks=include_headers_in_chunks,
        header_weight=header_weight,
    )
    
    # Store metadata in database
    _store_metadata_in_db(
        db_path=full_db_path,
        metadata=metadata,
        verbose=verbose
    )
    
    # Save metadata as YAML file
    _save_metadata_yaml(
        db_path=full_db_path,
        metadata=metadata,
        verbose=verbose
    )
    
    if verbose:
        print(f"\n{'=' * 80}")
        print(f"✓ Knowledge base created successfully!")
        print(f"{'=' * 80}")
        print(f"Database: {persist_dir}/{database_name}")
        print(f"Metadata: {database_name.replace('.duckdb', '.yaml')}")
        print()
        print(f"Embedding Model:")
        print(f"  Provider: {metadata['embedding']['provider']}")
        print(f"  Model: {metadata['embedding']['model']}")
        print(f"  Dimensions: {metadata['embedding']['dimensions']}")
        print()
        print(f"Documents:")
        print(f"  Source documents: {metadata['source_documents']['total_documents']}")
        print(f"  Total chunks: {metadata['chunks']['total_chunks']}")
        print(f"  Chunk size range: {metadata['chunks']['min_chunk_size']}-{metadata['chunks']['max_chunk_size']} characters")
        print(f"  Median chunk size: {metadata['chunks']['median_chunk_size']} characters")
        print()
        print(f"Features:")
        print(f"  ✓ Vector similarity search")
        print(f"  ✓ Full-text search (BM25)")
        print(f"  ✓ Hybrid retrieval (RRF)")
        print(f"  ✓ Source documents stored")
        print(f"  ✓ Metadata tracking")
        print(f"\nYou can now use this database for RAG applications.")
        print(f"{'=' * 80}")
    
    return knowledge_base

