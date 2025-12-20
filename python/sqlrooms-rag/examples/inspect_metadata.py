#!/usr/bin/env python3
"""
Example: Inspecting embedding metadata.

This demonstrates how to read and validate embedding metadata to ensure
query-time uses the same model as was used during preparation.
"""

from sqlrooms_rag import get_embedding_metadata, validate_embedding_model


def inspect_database(db_path: str = "generated-embeddings/sqlrooms_docs.duckdb"):
    """
    Show comprehensive information about an embeddings database.
    
    Args:
        db_path: Path to the DuckDB database
    """
    print("=" * 80)
    print("EMBEDDING DATABASE METADATA")
    print("=" * 80)
    print()
    
    try:
        metadata = get_embedding_metadata(db_path)
    except RuntimeError as e:
        print(f"Error: {e}")
        return
    
    # General info
    print(f"Database: {db_path}")
    print(f"Created: {metadata['created_at']}")
    print(f"Metadata Version: {metadata['version']}")
    print()
    
    # Embedding model info
    print("=" * 80)
    print("EMBEDDING MODEL")
    print("=" * 80)
    print(f"Provider: {metadata['embedding']['provider']}")
    print(f"Model: {metadata['embedding']['model']}")
    print(f"Dimensions: {metadata['embedding']['dimensions']}")
    print()
    
    # Chunking strategy
    print("=" * 80)
    print("CHUNKING STRATEGY")
    print("=" * 80)
    print(f"Strategy: {metadata['chunking']['strategy']}")
    print(f"Chunk Size: {metadata['chunking']['chunk_size']} tokens")
    print(f"Include Headers: {metadata['chunking']['include_headers']}")
    if metadata['chunking']['include_headers']:
        print(f"Header Weight: {metadata['chunking']['header_weight']}x")
    print()
    
    # Source documents
    print("=" * 80)
    print("SOURCE DOCUMENTS")
    print("=" * 80)
    print(f"Total Documents: {metadata['source_documents']['total_documents']}")
    print(f"Unique Files: {metadata['source_documents']['unique_files']}")
    print(f"Total Characters: {metadata['source_documents']['total_characters']:,}")
    print(f"Average Doc Size: {metadata['source_documents']['total_characters'] // metadata['source_documents']['total_documents']:,} characters")
    print()
    
    # Chunks
    print("=" * 80)
    print("CHUNKS")
    print("=" * 80)
    print(f"Total Chunks: {metadata['chunks']['total_chunks']}")
    print(f"Min Chunk Size: {metadata['chunks']['min_chunk_size']} characters")
    print(f"Max Chunk Size: {metadata['chunks']['max_chunk_size']} characters")
    print(f"Median Chunk Size: {metadata['chunks']['median_chunk_size']} characters")
    print(f"Mean Chunk Size: {metadata['chunks']['mean_chunk_size']} characters")
    print(f"Total Characters: {metadata['chunks']['total_characters']:,}")
    print(f"Chunks per Document: {metadata['chunks']['total_chunks'] / metadata['source_documents']['total_documents']:.1f}")
    print()
    
    # Capabilities
    print("=" * 80)
    print("CAPABILITIES")
    print("=" * 80)
    features = []
    if metadata['capabilities']['hybrid_search']:
        features.append("✓ Hybrid search (Vector + FTS)")
    if metadata['capabilities']['fts_enabled']:
        features.append("✓ Full-text search (BM25)")
    if metadata['capabilities']['source_documents_stored']:
        features.append("✓ Source documents stored")
    
    for feature in features:
        print(feature)
    print()
    
    # Recommendations
    print("=" * 80)
    print("QUERY RECOMMENDATIONS")
    print("=" * 80)
    print(f"Use Model: {metadata['embedding']['model']}")
    print(f"Expected Dimensions: {metadata['embedding']['dimensions']}")
    print()
    
    if metadata['embedding']['provider'] == 'openai':
        print("⚠ This database uses OpenAI embeddings.")
        print("  You'll need an API key to query with the same model.")
        print()
    
    if metadata['capabilities']['hybrid_search']:
        print("✓ This database supports hybrid search.")
        print("  Use hybrid_query() for best results.")
    else:
        print("  Use vector-only search.")
    print()


def validate_query_model(
    db_path: str = "generated-embeddings/sqlrooms_docs.duckdb",
    query_model: str = "BAAI/bge-small-en-v1.5",
):
    """
    Validate that a query model matches the database.
    
    Args:
        db_path: Path to the DuckDB database
        query_model: Model name you plan to use for queries
    """
    print("=" * 80)
    print("MODEL VALIDATION")
    print("=" * 80)
    print()
    print(f"Database: {db_path}")
    print(f"Query Model: {query_model}")
    print()
    
    try:
        is_valid = validate_embedding_model(db_path, query_model)
        
        if is_valid:
            print("✓ Model matches! You can safely query this database.")
        else:
            print("✗ Model mismatch detected!")
            print()
            print("Using a different model will produce poor results.")
            print("Either:")
            print("  1. Use the correct model shown above")
            print("  2. Re-generate embeddings with your preferred model")
        
        print()
    except Exception as e:
        print(f"Error: {e}")
        print()


def compare_databases(
    db1_path: str,
    db2_path: str,
):
    """
    Compare metadata from two databases.
    
    Args:
        db1_path: Path to first database
        db2_path: Path to second database
    """
    print("=" * 80)
    print("DATABASE COMPARISON")
    print("=" * 80)
    print()
    
    try:
        meta1 = get_embedding_metadata(db1_path)
        meta2 = get_embedding_metadata(db2_path)
    except Exception as e:
        print(f"Error: {e}")
        return
    
    # Compare embedding models
    print("Embedding Models:")
    print(f"  DB1: {meta1['embedding']['provider']} / {meta1['embedding']['model']} ({meta1['embedding']['dimensions']} dims)")
    print(f"  DB2: {meta2['embedding']['provider']} / {meta2['embedding']['model']} ({meta2['embedding']['dimensions']} dims)")
    
    if meta1['embedding']['model'] == meta2['embedding']['model']:
        print("  ✓ Same model - databases are compatible")
    else:
        print("  ✗ Different models - cannot merge or compare results")
    print()
    
    # Compare sizes
    print("Database Sizes:")
    print(f"  DB1: {meta1['source_documents']['total_documents']} docs, {meta1['chunks']['total_chunks']} chunks")
    print(f"  DB2: {meta2['source_documents']['total_documents']} docs, {meta2['chunks']['total_chunks']} chunks")
    print()
    
    # Compare strategies
    print("Chunking:")
    print(f"  DB1: {meta1['chunking']['strategy']} (size: {meta1['chunking']['chunk_size']})")
    print(f"  DB2: {meta2['chunking']['strategy']} (size: {meta2['chunking']['chunk_size']})")
    print()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "--inspect" and len(sys.argv) > 2:
            inspect_database(sys.argv[2])
        elif command == "--validate" and len(sys.argv) > 3:
            validate_query_model(sys.argv[2], sys.argv[3])
        elif command == "--compare" and len(sys.argv) > 3:
            compare_databases(sys.argv[2], sys.argv[3])
        else:
            print("Usage:")
            print("  python inspect_metadata.py --inspect <db_path>")
            print("  python inspect_metadata.py --validate <db_path> <model_name>")
            print("  python inspect_metadata.py --compare <db1_path> <db2_path>")
    else:
        # Default: inspect default database
        inspect_database()
        print()
        validate_query_model()

