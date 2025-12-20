#!/usr/bin/env python3
"""
Query the embeddings database directly using DuckDB without llama-index.

This demonstrates how to:
1. Connect to the DuckDB database
2. Generate query embeddings
3. Perform vector similarity search using SQL
4. Perform full-text search using SQL
5. Combine results with Reciprocal Rank Fusion (RRF)
6. Retrieve source documents
"""

import duckdb
import json
from typing import List, Tuple, Dict
from sentence_transformers import SentenceTransformer


def query_embeddings_db(
    query_text: str,
    db_path: str = "generated-embeddings/sqlrooms_docs.duckdb",
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
                except Exception:
                    pass
            if isinstance(metadata, dict) and 'file_name' in metadata:
                print(f"   Source: {metadata['file_name']}")
        print(f"   Text Preview:\n   {text[:500]}...")
        print("-" * 80)
    
    conn.close()


def explore_database(db_path: str = "generated-embeddings/sqlrooms_docs.duckdb"):
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


def reciprocal_rank_fusion(rankings: List[List[str]], k: int = 60) -> List[Tuple[str, float]]:
    """
    Combine multiple ranked lists using Reciprocal Rank Fusion.
    
    RRF_score(doc) = sum(1/(k + rank)) across all ranking systems.
    
    Args:
        rankings: List of ranked lists (each list contains IDs in rank order)
        k: RRF constant (default: 60, from original paper)
    
    Returns:
        List of (id, score) tuples sorted by RRF score (highest first)
    """
    rrf_scores: Dict[str, float] = {}
    
    for ranking in rankings:
        for rank, item_id in enumerate(ranking, start=1):
            if item_id not in rrf_scores:
                rrf_scores[item_id] = 0.0
            rrf_scores[item_id] += 1.0 / (k + rank)
    
    # Sort by score descending
    return sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)


def hybrid_query_direct(
    query_text: str,
    db_path: str = "generated-embeddings/sqlrooms_docs.duckdb",
    model_name: str = "BAAI/bge-small-en-v1.5",
    top_k: int = 5,
    vector_top_k: int = 10,
    fts_top_k: int = 10,
):
    """
    Perform hybrid search using direct DuckDB SQL queries.
    
    This demonstrates the low-level approach combining:
    - Vector similarity search (cosine similarity)
    - Full-text search (BM25)
    - Reciprocal Rank Fusion to combine results
    
    Args:
        query_text: The search query
        db_path: Path to the DuckDB database
        model_name: The embedding model to use
        top_k: Number of final results to return
        vector_top_k: Number of results from vector search
        fts_top_k: Number of results from FTS search
    """
    print(f"Loading embedding model: {model_name}...")
    model = SentenceTransformer(model_name)
    
    print(f"Generating embedding for query: '{query_text}'")
    query_embedding = model.encode(query_text).tolist()
    
    print(f"Connecting to database: {db_path}")
    conn = duckdb.connect(db_path, read_only=True)
    
    # Load FTS extension
    conn.execute("INSTALL fts; LOAD fts;")
    
    # 1. Vector similarity search
    print(f"\n[1/3] Running vector similarity search (top {vector_top_k})...")
    vector_query = """
        SELECT 
            node_id,
            text,
            metadata_,
            array_cosine_similarity(embedding, ?::FLOAT[384]) as score
        FROM documents
        ORDER BY score DESC
        LIMIT ?
    """
    vector_results = conn.execute(vector_query, [query_embedding, vector_top_k]).fetchall()
    print(f"      Found {len(vector_results)} vector results")
    
    # 2. Full-text search
    print(f"[2/3] Running full-text search (top {fts_top_k})...")
    try:
        fts_query = """
            SELECT 
                node_id,
                text,
                metadata_,
                fts_main_documents.match_bm25(node_id, ?) as score
            FROM documents
            WHERE fts_main_documents.match_bm25(node_id, ?) IS NOT NULL
            ORDER BY score DESC
            LIMIT ?
        """
        fts_results = conn.execute(fts_query, [query_text, query_text, fts_top_k]).fetchall()
        print(f"      Found {len(fts_results)} FTS results")
    except Exception as e:
        print(f"      Warning: FTS search failed: {e}")
        print("      Continuing with vector-only results...")
        fts_results = []
    
    # 3. Combine with Reciprocal Rank Fusion
    print("[3/3] Combining results with Reciprocal Rank Fusion...")
    
    # Extract rankings (node_ids in order)
    vector_ranking = [r[0] for r in vector_results]
    fts_ranking = [r[0] for r in fts_results]
    
    # Compute RRF scores
    rrf_scores = reciprocal_rank_fusion([vector_ranking, fts_ranking])
    
    # Get top_k by RRF score
    [node_id for node_id, _ in rrf_scores[:top_k]]
    
    # Create lookup map for full details
    result_map = {}
    for node_id, text, metadata, score in vector_results + fts_results:
        if node_id not in result_map:
            result_map[node_id] = (text, metadata)
    
    # Build final results
    print(f"\nQuery: {query_text}")
    print("=" * 80)
    print(f"\nTop {top_k} Hybrid Results (Vector + FTS with RRF):\n")
    
    for i, (node_id, rrf_score) in enumerate(rrf_scores[:top_k], 1):
        if node_id in result_map:
            text, metadata = result_map[node_id]
            
            # Parse metadata
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except Exception:
                    metadata = {}
            
            print(f"{i}. RRF Score: {rrf_score:.4f}")
            print(f"   Node ID: {node_id}")
            if isinstance(metadata, dict) and 'file_name' in metadata:
                print(f"   Source: {metadata['file_name']}")
            print(f"   Text Preview:\n   {text[:400]}...")
            print("-" * 80)
    
    conn.close()


def get_source_document(
    node_id: str,
    db_path: str = "generated-embeddings/sqlrooms_docs.duckdb"
):
    """
    Retrieve the full source document for a given chunk.
    
    Args:
        node_id: The chunk's node_id
        db_path: Path to the DuckDB database
    """
    conn = duckdb.connect(db_path, read_only=True)
    
    # Get doc_id from chunk
    doc_id_query = "SELECT doc_id FROM documents WHERE node_id = ?"
    doc_id_result = conn.execute(doc_id_query, [node_id]).fetchone()
    
    if not doc_id_result or not doc_id_result[0]:
        print(f"No source document found for node_id: {node_id}")
        conn.close()
        return None
    
    doc_id = doc_id_result[0]
    
    # Get full source document
    doc_query = """
        SELECT doc_id, file_path, file_name, text, metadata_
        FROM source_documents
        WHERE doc_id = ?
    """
    result = conn.execute(doc_query, [doc_id]).fetchone()
    
    if result:
        doc_id, file_path, file_name, text, metadata = result
        
        # Parse metadata
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except Exception:
                metadata = {}
        
        print("\n" + "=" * 80)
        print("FULL SOURCE DOCUMENT")
        print("=" * 80)
        print(f"Document ID: {doc_id}")
        print(f"File: {file_name}")
        print(f"Path: {file_path}")
        print(f"Length: {len(text)} characters")
        print(f"\nFull Text:\n{text}")
        print("=" * 80)
    else:
        print(f"Source document not found for doc_id: {doc_id}")
    
    conn.close()


def compare_search_methods(
    query_text: str,
    db_path: str = "generated-embeddings/sqlrooms_docs.duckdb",
    model_name: str = "BAAI/bge-small-en-v1.5",
    top_k: int = 3,
):
    """
    Compare vector-only vs hybrid search side-by-side.
    
    Args:
        query_text: The search query
        db_path: Path to the DuckDB database
        model_name: The embedding model to use
        top_k: Number of results to show
    """
    print("=" * 80)
    print("COMPARISON: Vector-Only vs Hybrid Search")
    print("=" * 80)
    print(f"\nQuery: '{query_text}'\n")
    
    model = SentenceTransformer(model_name)
    query_embedding = model.encode(query_text).tolist()
    conn = duckdb.connect(db_path, read_only=True)
    conn.execute("INSTALL fts; LOAD fts;")
    
    # Vector-only search
    print("\n" + "-" * 80)
    print("METHOD 1: Vector-Only Search")
    print("-" * 80)
    
    vector_query = """
        SELECT 
            node_id,
            text,
            metadata_,
            array_cosine_similarity(embedding, ?::FLOAT[384]) as score
        FROM documents
        ORDER BY score DESC
        LIMIT ?
    """
    vector_results = conn.execute(vector_query, [query_embedding, top_k]).fetchall()
    
    for i, (node_id, text, metadata, score) in enumerate(vector_results, 1):
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except Exception:
                metadata = {}
        source = metadata.get('file_name', 'Unknown') if isinstance(metadata, dict) else 'Unknown'
        print(f"{i}. [{score:.4f}] {source}")
        print(f"   {text[:200]}...")
        print()
    
    # Hybrid search
    print("-" * 80)
    print("METHOD 2: Hybrid Search (Vector + FTS with RRF)")
    print("-" * 80)
    
    # Vector results
    vector_top_k = top_k * 2
    vector_results_hybrid = conn.execute(vector_query, [query_embedding, vector_top_k]).fetchall()
    vector_ranking = [r[0] for r in vector_results_hybrid]
    
    # FTS results
    try:
        fts_query = """
            SELECT 
                node_id,
                text,
                metadata_,
                fts_main_documents.match_bm25(node_id, ?) as score
            FROM documents
            WHERE fts_main_documents.match_bm25(node_id, ?) IS NOT NULL
            ORDER BY score DESC
            LIMIT ?
        """
        fts_results = conn.execute(fts_query, [query_text, query_text, vector_top_k]).fetchall()
        fts_ranking = [r[0] for r in fts_results]
        
        # RRF fusion
        rrf_scores = reciprocal_rank_fusion([vector_ranking, fts_ranking])
        
        # Build result map
        result_map = {}
        for node_id, text, metadata, score in vector_results_hybrid + fts_results:
            if node_id not in result_map:
                result_map[node_id] = (text, metadata)
        
        # Show top results
        for i, (node_id, rrf_score) in enumerate(rrf_scores[:top_k], 1):
            if node_id in result_map:
                text, metadata = result_map[node_id]
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except Exception:
                        metadata = {}
                source = metadata.get('file_name', 'Unknown') if isinstance(metadata, dict) else 'Unknown'
                print(f"{i}. [RRF: {rrf_score:.4f}] {source}")
                print(f"   {text[:200]}...")
                print()
    except Exception as e:
        print(f"FTS search failed: {e}")
        print("Hybrid search requires FTS index (created automatically in prepare_embeddings)")
    
    print("-" * 80)
    print("\nAnalysis:")
    print("Hybrid search typically performs better because:")
    print("- FTS catches exact term matches")
    print("- Vector search adds semantic context")
    print("- RRF balances both signals without manual tuning")
    print("=" * 80)
    
    conn.close()


def batch_query(
    queries: list[str],
    db_path: str = "generated-embeddings/sqlrooms_docs.duckdb",
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
                except Exception:
                    metadata = None
            source = metadata.get('file_name', 'Unknown') if metadata and isinstance(metadata, dict) else 'Unknown'
            print(f"{i}. [{similarity:.4f}] {source}: {text[:150]}...")
    
    conn.close()
    print("\n" + "=" * 80)


if __name__ == "__main__":
    import sys
    
    # Check command-line arguments
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "--compare" and len(sys.argv) > 2:
            # Compare search methods
            query = " ".join(sys.argv[2:])
            compare_search_methods(query, top_k=5)
        elif command == "--hybrid":
            # Run hybrid search
            query = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else "How do I use DuckDB?"
            hybrid_query_direct(query)
        elif command == "--source" and len(sys.argv) > 2:
            # Get source document for a node
            node_id = sys.argv[2]
            get_source_document(node_id)
        elif command == "--explore":
            # Explore database
            explore_database()
        else:
            # Default: vector-only query
            query = " ".join(sys.argv[1:])
            query_embeddings_db(query)
    else:
        # No arguments: run demo
        print("=" * 80)
        print("DIRECT DUCKDB QUERY EXAMPLES")
        print("=" * 80)
        print("\nThis demonstrates low-level SQL queries for RAG retrieval.")
        print("\nAvailable modes:")
        print("  python query_duckdb_direct.py --explore")
        print("  python query_duckdb_direct.py --hybrid 'your query'")
        print("  python query_duckdb_direct.py --compare 'your query'")
        print("  python query_duckdb_direct.py --source <node_id>")
        print("  python query_duckdb_direct.py 'your query'  (vector-only)")
        print()
        
        # Example 1: Explore the database
        print("=" * 80)
        print("EXAMPLE 1: DATABASE EXPLORATION")
        print("=" * 80)
        explore_database()
        
        print("\n\n")
        
        # Example 2: Hybrid search
        print("=" * 80)
        print("EXAMPLE 2: HYBRID SEARCH (Vector + FTS with RRF)")
        print("=" * 80)
        hybrid_query_direct("What is DuckDB ARRAY_AGG function?", top_k=3)
        
        print("\n\n")
        
        # Example 3: Comparison
        print("=" * 80)
        print("EXAMPLE 3: VECTOR VS HYBRID COMPARISON")
        print("=" * 80)
        compare_search_methods("DuckDB window functions", top_k=3)

