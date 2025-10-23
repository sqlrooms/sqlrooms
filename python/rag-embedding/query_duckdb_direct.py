#!/usr/bin/env python3
"""
Query the embeddings database directly using DuckDB without llama-index.

This demonstrates how to:
1. Connect to the DuckDB database
2. Generate query embeddings
3. Perform vector similarity search using SQL
4. Retrieve relevant documents
"""

import duckdb
import json
from sentence_transformers import SentenceTransformer


def query_embeddings_db(
    query_text: str,
    db_path: str = "sqlrooms_docs",
    model_name: str = "BAAI/bge-small-en-v1.5",
    top_k: int = 3,
):
    """
    Query the embeddings database directly using DuckDB.
    
    Args:
        query_text: The search query
        db_path: Path to the DuckDB database
        model_name: The embedding model to use (must match what was used to create the DB)
        top_k: Number of results to return
    """
    # Load the embedding model
    print(f"Loading embedding model: {model_name}...")
    model = SentenceTransformer(model_name)
    
    # Generate embedding for the query
    print(f"Generating embedding for query: '{query_text}'")
    query_embedding = model.encode(query_text).tolist()
    
    # Connect to DuckDB
    print(f"Connecting to database: {db_path}")
    conn = duckdb.connect(db_path, read_only=True)
    
    # Perform vector similarity search using cosine similarity
    # DuckDB supports array_cosine_similarity for cosine similarity
    query = """
        SELECT 
            node_id,
            text,
            metadata_,
            array_cosine_similarity(embedding, ?::FLOAT[384]) as similarity
        FROM documents
        ORDER BY similarity DESC
        LIMIT ?
    """
    
    print(f"\nExecuting similarity search (top {top_k} results)...")
    results = conn.execute(query, [query_embedding, top_k]).fetchall()
    
    # Display results
    print(f"\nQuery: {query_text}")
    print("=" * 80)
    print(f"\nFound {len(results)} results:\n")
    
    for i, (node_id, text, metadata, similarity) in enumerate(results, 1):
        print(f"{i}. Similarity Score: {similarity:.4f}")
        print(f"   Node ID: {node_id}")
        if metadata:
            # Parse JSON string to dict if needed
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    pass
            if isinstance(metadata, dict) and 'file_name' in metadata:
                print(f"   Source: {metadata['file_name']}")
        print(f"   Text Preview:\n   {text[:500]}...")
        print("-" * 80)
    
    conn.close()


def explore_database(db_path: str = "sqlrooms_docs"):
    """
    Show information about the database schema and contents.
    
    Args:
        db_path: Path to the DuckDB database
    """
    conn = duckdb.connect(db_path, read_only=True)
    
    print("Database Schema:")
    print("=" * 80)
    schema = conn.execute("SHOW TABLES").fetchall()
    print("Tables:", schema)
    
    print("\nDocuments Table Schema:")
    table_info = conn.execute("DESCRIBE documents").fetchall()
    for col in table_info:
        print(f"  - {col[0]}: {col[1]}")
    
    print("\nDatabase Statistics:")
    stats = conn.execute("""
        SELECT 
            COUNT(*) as total_documents,
            AVG(length(text)) as avg_text_length,
            MIN(length(text)) as min_text_length,
            MAX(length(text)) as max_text_length
        FROM documents
    """).fetchone()
    
    print(f"  Total documents: {stats[0]}")
    print(f"  Average text length: {stats[1]:.0f} characters")
    print(f"  Min text length: {stats[2]} characters")
    print(f"  Max text length: {stats[3]} characters")
    
    print("\nSample Document:")
    sample = conn.execute("SELECT text, metadata_ FROM documents LIMIT 1").fetchone()
    print(f"  Text preview: {sample[0][:200]}...")
    print(f"  Metadata: {sample[1]}")
    
    conn.close()


def batch_query(
    queries: list[str],
    db_path: str = "sqlrooms_docs",
    model_name: str = "BAAI/bge-small-en-v1.5",
    top_k: int = 3,
):
    """
    Efficiently query multiple questions by reusing the model and connection.
    
    Args:
        queries: List of search queries
        db_path: Path to the DuckDB database
        model_name: The embedding model to use
        top_k: Number of results per query
    """
    # Load model once
    print(f"Loading embedding model: {model_name}...")
    model = SentenceTransformer(model_name)
    
    # Connect to database once
    conn = duckdb.connect(db_path, read_only=True)
    
    for query_text in queries:
        print("\n" + "=" * 80)
        
        # Generate embedding
        query_embedding = model.encode(query_text).tolist()
        
        # Search
        query = """
            SELECT 
                text,
                metadata_,
                array_cosine_similarity(embedding, ?::FLOAT[384]) as similarity
            FROM documents
            ORDER BY similarity DESC
            LIMIT ?
        """
        
        results = conn.execute(query, [query_embedding, top_k]).fetchall()
        
        # Display
        print(f"Query: {query_text}")
        print(f"Top {len(results)} results:")
        print("-" * 80)
        
        for i, (text, metadata, similarity) in enumerate(results, 1):
            # Parse JSON string to dict if needed
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    metadata = None
            source = metadata.get('file_name', 'Unknown') if metadata and isinstance(metadata, dict) else 'Unknown'
            print(f"{i}. [{similarity:.4f}] {source}: {text[:150]}...")
    
    conn.close()
    print("\n" + "=" * 80)


if __name__ == "__main__":
    import sys
    
    # Example 1: Explore the database
    print("=" * 80)
    print("DATABASE EXPLORATION")
    print("=" * 80)
    explore_database()
    
    print("\n\n")
    
    # Example 2: Single query
    if len(sys.argv) > 1:
        # Use command-line argument as query
        query = " ".join(sys.argv[1:])
        query_embeddings_db(query)
    else:
        # Example 3: Batch queries
        print("=" * 80)
        print("BATCH QUERY EXAMPLES")
        print("=" * 80)
        
        example_queries = [
            "What is SQLRooms?",
            "How do I use DuckDB?",
            "What visualization libraries are supported?",
            "How to manage state in SQLRooms?",
        ]
        
        batch_query(example_queries, top_k=2)

