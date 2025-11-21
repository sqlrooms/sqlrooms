"""
Metadata creation and storage for embedding databases.
"""

import yaml
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

import duckdb


def calculate_chunk_stats(nodes: list) -> Dict[str, Any]:
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


def create_metadata(
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
    chunk_stats = calculate_chunk_stats(nodes)
    
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


def store_metadata_in_db(db_path: Path, metadata: Dict[str, Any], verbose: bool = True) -> None:
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


def save_metadata_yaml(db_path: Path, metadata: Dict[str, Any], verbose: bool = True) -> None:
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

