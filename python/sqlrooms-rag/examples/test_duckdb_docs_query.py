#!/usr/bin/env python3
"""
Test querying DuckDB documentation embeddings.

This script demonstrates how to query the prepared DuckDB documentation
embeddings and shows example results.

Usage:
    uv run python test_duckdb_docs_query.py
    uv run python test_duckdb_docs_query.py "Your question here"
"""

import sys
from pathlib import Path

import duckdb
from sentence_transformers import SentenceTransformer


def test_query(
    query_text: str,
    db_path: str = "generated-embeddings/duckdb_docs.duckdb",
    model_name: str = "BAAI/bge-small-en-v1.5",
    top_k: int = 5,
):
    """
    Query the DuckDB documentation embeddings.
    
    Args:
        query_text: The question to ask
        db_path: Path to the embeddings database
        model_name: Embedding model to use (must match what was used to create the DB)
        top_k: Number of results to return
    """
    # Check if database exists
    db_file = Path(db_path)
    if not db_file.exists():
        print(f"❌ Error: Database not found at {db_path}", file=sys.stderr)
        print("\nPlease run the preparation script first:", file=sys.stderr)
        print("  uv run python examples/prepare_duckdb_docs.py", file=sys.stderr)
        sys.exit(1)
    
    print("🔍 Testing DuckDB Documentation Query")
    print("=" * 80)
    print(f"Database: {db_path}")
    print(f"Query: {query_text}")
    print("=" * 80)
    print()
    
    # Load the embedding model
    print("⏳ Loading embedding model...")
    model = SentenceTransformer(model_name)
    
    # Generate embedding for the query
    print("⏳ Generating query embedding...")
    query_embedding = model.encode(query_text).tolist()
    print(f"✓ Generated {len(query_embedding)}-dimensional embedding")
    print()
    
    # Connect to DuckDB
    print("⏳ Connecting to database...")
    conn = duckdb.connect(db_path, read_only=True)
    
    # Get database statistics
    stats = conn.execute("""
        SELECT 
            COUNT(*) as total_chunks,
            COUNT(DISTINCT metadata_->>'$.file_name') as total_files
        FROM documents
    """).fetchone()
    
    print("✓ Connected to database")
    print(f"  - Total document chunks: {stats[0]}")
    print(f"  - Total source files: {stats[1]}")
    print()
    
    # Perform vector similarity search
    query = f"""
        SELECT 
            text,
            metadata_->>'$.file_name' as file_name,
            array_cosine_similarity(embedding, ?::FLOAT[{len(query_embedding)}]) as similarity
        FROM documents
        ORDER BY similarity DESC
        LIMIT ?
    """
    
    print(f"⏳ Searching for top {top_k} most similar chunks...")
    results = conn.execute(query, [query_embedding, top_k]).fetchall()
    conn.close()
    
    # Display results
    print()
    print("📊 RESULTS")
    print("=" * 80)
    
    if not results:
        print("No results found.")
        return
    
    for i, (text, file_name, similarity) in enumerate(results, 1):
        print()
        print(f"🔖 Result #{i}")
        print(f"   Score: {similarity:.4f} ({similarity * 100:.1f}%)")
        print(f"   Source: {file_name or 'Unknown'}")
        print("   Text:")
        
        # Display text with word wrap
        max_length = 500
        if len(text) > max_length:
            text = text[:max_length] + "..."
        
        # Indent the text
        for line in text.split('\n'):
            if line.strip():
                print(f"      {line}")
        
        print()
        print("-" * 80)
    
    print()
    print("✅ Query completed successfully!")
    print()


def run_predefined_tests():
    """Run a series of predefined test queries."""
    test_queries = [
        "What is a window function?",
        "How do I connect to S3?",
        "JSON functions in DuckDB",
        "How to use UNION ALL?",
        "What are aggregate functions?",
    ]
    
    print("🧪 Running Predefined Test Queries")
    print("=" * 80)
    print()
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n{'=' * 80}")
        print(f"Test {i}/{len(test_queries)}")
        print(f"{'=' * 80}\n")
        
        try:
            test_query(query, top_k=3)
        except Exception as e:
            print(f"❌ Error: {e}", file=sys.stderr)
            continue
        
        if i < len(test_queries):
            input("\nPress Enter to continue to next test...")


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Test querying DuckDB documentation embeddings",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run predefined test queries
  %(prog)s
  
  # Query with a specific question
  %(prog)s "What is a window function?"
  
  # Custom database path
  %(prog)s --db ./my-embeddings/duckdb.duckdb "How to use JSON?"
  
  # Get more results
  %(prog)s --top-k 10 "aggregate functions"
        """,
    )
    
    parser.add_argument(
        "query",
        nargs="?",
        help="Question to ask (if not provided, runs predefined tests)",
    )
    
    parser.add_argument(
        "--db",
        default="generated-embeddings/duckdb_docs.duckdb",
        help="Path to embeddings database (default: generated-embeddings/duckdb_docs.duckdb)",
    )
    
    parser.add_argument(
        "--model",
        default="BAAI/bge-small-en-v1.5",
        help="Embedding model name (default: BAAI/bge-small-en-v1.5)",
    )
    
    parser.add_argument(
        "--top-k",
        type=int,
        default=5,
        help="Number of results to return (default: 5)",
    )
    
    args = parser.parse_args()
    
    try:
        if args.query:
            # Single query mode
            test_query(
                query_text=args.query,
                db_path=args.db,
                model_name=args.model,
                top_k=args.top_k,
            )
        else:
            # Run predefined tests
            run_predefined_tests()
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user.", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

