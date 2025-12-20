#!/usr/bin/env python3
"""
Example: Hybrid Retrieval combining Vector Search + Full-Text Search

This demonstrates how to use both semantic similarity (vector embeddings)
and keyword matching (full-text search) together for better RAG results.

Benefits of Hybrid Search:
- Vector search: Finds conceptually similar content even with different words
- FTS: Finds exact matches, acronyms, code snippets, specific terms
- Combined: Best of both worlds using Reciprocal Rank Fusion (RRF)

Note: The FTS index is automatically created during prepare_embeddings(),
so no manual setup is required!
"""

from sqlrooms_rag import hybrid_query, print_results, get_source_documents


def main():
    db_path = "generated-embeddings/sqlrooms_docs.duckdb"
    
    print("=" * 80)
    print("Hybrid Search Examples")
    print("=" * 80)
    print("\nFTS index was created automatically during prepare_embeddings()\n")
    
    # Example queries that benefit from hybrid search
    examples = [
        {
            "query": "What is useState in React?",
            "why": "Benefits from FTS for exact term 'useState' + vector for React concepts"
        },
        {
            "query": "DuckDB array functions",
            "why": "FTS finds exact 'DuckDB' mentions + vector understands 'array functions'"
        },
        {
            "query": "how to create a chart visualization",
            "why": "Vector search for semantic 'visualization' + FTS for 'chart'"
        },
        {
            "query": "SQL ROLLUP GROUP BY",
            "why": "FTS excels at SQL keywords, vector adds contextual understanding"
        },
    ]
    
    for i, example in enumerate(examples, 1):
        print(f"\n{'=' * 80}")
        print(f"Example {i}/{len(examples)}")
        print(f"{'=' * 80}")
        print(f"\nWhy hybrid helps: {example['why']}\n")
        
        # Run hybrid query with RRF
        results = hybrid_query(
            example["query"],
            db_path=db_path,
            top_k=3,
            use_rrf=True,  # Use Reciprocal Rank Fusion
            verbose=True,
        )
        
        print_results(results, example["query"])
        
        # Show how to retrieve full source documents
        if i == 1 and results:
            print("\n" + "=" * 80)
            print("BONUS: Retrieving Full Source Documents")
            print("=" * 80)
            print("\nAfter finding relevant chunks, you can retrieve the full documents:")
            
            chunk_ids = [r['node_id'] for r in results[:1]]  # Just first result
            source_docs = get_source_documents(chunk_ids, db_path)
            
            if source_docs:
                doc = source_docs[0]
                print("\nSource Document:")
                print(f"  File: {doc['file_name']}")
                print(f"  Path: {doc['file_path']}")
                print(f"  Length: {len(doc['text'])} characters")
                print(f"  Preview: {doc['text'][:200]}...")
        
        if i < len(examples):
            input("\nPress Enter for next example...")


def compare_methods():
    """
    Compare pure vector search vs hybrid search side-by-side.
    """
    from sqlrooms_rag.query import hybrid_query
    
    db_path = "generated-embeddings/sqlrooms_docs.duckdb"
    query = "DuckDB ARRAY_AGG function"
    
    print("=" * 80)
    print("COMPARISON: Vector-Only vs Hybrid Search")
    print("=" * 80)
    print(f"\nQuery: '{query}'\n")
    
    # This query benefits from hybrid because:
    # - "DuckDB" and "ARRAY_AGG" are specific terms (FTS strong)
    # - "function" is semantic/conceptual (vector strong)
    
    print("\n" + "=" * 80)
    print("METHOD 1: Hybrid Search (Vector + FTS with RRF)")
    print("=" * 80)
    
    hybrid_results = hybrid_query(
        query,
        db_path=db_path,
        top_k=5,
        use_rrf=True,
        verbose=True,
    )
    
    print_results(hybrid_results, query)
    
    print("\n\n" + "=" * 80)
    print("METHOD 2: Vector-Only Search")
    print("=" * 80)
    
    # Simulate vector-only by setting FTS results to 0
    # In practice, you'd query vector store directly
    vector_results = hybrid_query(
        query,
        db_path=db_path,
        top_k=5,
        fts_top_k=0,  # No FTS results
        verbose=True,
    )
    
    print_results(vector_results, query)
    
    print("\n" + "=" * 80)
    print("ANALYSIS")
    print("=" * 80)
    print("""
Hybrid search typically performs better because:
1. FTS catches exact term matches (ARRAY_AGG, DuckDB)
2. Vector search adds semantic context
3. RRF balances both signals without manual tuning

For RAG systems, hybrid retrieval improves both:
- Precision: More relevant results in top positions
- Recall: Catches matches that pure vector search might miss
""")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--compare":
        compare_methods()
    else:
        main()

