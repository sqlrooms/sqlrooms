"""
Query functionality for hybrid retrieval combining vector similarity and full-text search.
"""

import duckdb
import json
from typing import List, Dict, Any, Optional, Tuple
from sentence_transformers import SentenceTransformer


def get_source_documents(
    chunk_ids: List[str],
    db_path: str = "generated-embeddings/sqlrooms_docs.duckdb"
) -> List[Dict[str, Any]]:
    """
    Retrieve full source documents for given chunk IDs.
    
    After finding relevant chunks through vector/hybrid search, use this to
    get the complete original documents for full context.
    
    Args:
        chunk_ids: List of node_id values from search results
        db_path: Path to the DuckDB database
    
    Returns:
        List of source document dictionaries with keys: doc_id, file_path, 
        file_name, text, metadata
    """
    if not chunk_ids:
        return []
    
    conn = duckdb.connect(db_path, read_only=True)
    
    try:
        # Get source document IDs from chunks
        placeholders = ','.join(['?'] * len(chunk_ids))
        query = f"""
            SELECT DISTINCT d.doc_id
            FROM documents d
            WHERE d.node_id IN ({placeholders})
            AND d.doc_id IS NOT NULL
        """
        doc_ids = [row[0] for row in conn.execute(query, chunk_ids).fetchall()]
        
        if not doc_ids:
            return []
        
        # Retrieve full source documents
        placeholders = ','.join(['?'] * len(doc_ids))
        query = f"""
            SELECT doc_id, file_path, file_name, text, metadata_
            FROM source_documents
            WHERE doc_id IN ({placeholders})
        """
        results = conn.execute(query, doc_ids).fetchall()
        
        # Format results
        documents = []
        for doc_id, file_path, file_name, text, metadata in results:
            # Parse JSON metadata
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    metadata = {}
            
            documents.append({
                'doc_id': doc_id,
                'file_path': file_path,
                'file_name': file_name,
                'text': text,
                'metadata': metadata
            })
        
        return documents
        
    finally:
        conn.close()


def reciprocal_rank_fusion(
    rankings: List[List[str]],
    k: int = 60
) -> List[Tuple[str, float]]:
    """
    Combine multiple ranked lists using Reciprocal Rank Fusion.
    
    RRF score = sum(1/(k + rank)) across all ranking systems.
    This is a robust way to combine rankings without needing normalized scores.
    
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


def hybrid_query(
    query_text: str,
    db_path: str = "generated-embeddings/sqlrooms_docs.duckdb",
    model_name: str = "BAAI/bge-small-en-v1.5",
    top_k: int = 5,
    vector_weight: float = 0.5,
    use_rrf: bool = True,
    vector_top_k: Optional[int] = None,
    fts_top_k: Optional[int] = None,
    include_source_docs: bool = False,
    verbose: bool = False,
) -> List[Dict[str, Any]]:
    """
    Query using hybrid retrieval: combines vector similarity and full-text search.
    
    This approach leverages both:
    - Semantic similarity (vector search) for conceptual matches
    - Keyword matching (FTS) for exact terms, acronyms, code snippets
    
    Args:
        query_text: The search query
        db_path: Path to the DuckDB database
        model_name: Embedding model name (must match preparation model)
        top_k: Number of final results to return
        vector_weight: Weight for vector scores vs FTS (only used if use_rrf=False)
        use_rrf: Use Reciprocal Rank Fusion instead of weighted score combination
        vector_top_k: Number of results from vector search (default: 2*top_k)
        fts_top_k: Number of results from FTS search (default: 2*top_k)
        include_source_docs: If True, fetch and include full source documents
        verbose: Print detailed progress information
    
    Returns:
        List of result dictionaries with keys: node_id, text, metadata, score
        If include_source_docs=True, also includes: source_doc (full document dict)
    
    Raises:
        RuntimeError: If FTS index doesn't exist (created automatically during prepare_embeddings)
    """
    # Default to fetching more results from each system than final top_k
    if vector_top_k is None:
        vector_top_k = max(top_k * 2, 10)
    if fts_top_k is None:
        fts_top_k = max(top_k * 2, 10)
    
    # Load embedding model
    if verbose:
        print(f"Loading embedding model: {model_name}...")
    model = SentenceTransformer(model_name)
    
    # Generate query embedding
    if verbose:
        print(f"Generating embedding for query: '{query_text}'")
    query_embedding = model.encode(query_text).tolist()
    
    # Connect to database
    conn = duckdb.connect(db_path, read_only=True)
    
    try:
        # Load FTS extension
        conn.execute("INSTALL fts; LOAD fts;")
        
        # 1. Vector similarity search
        if verbose:
            print(f"Running vector similarity search (top {vector_top_k})...")
        
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
        vector_results = conn.execute(
            vector_query, 
            [query_embedding, vector_top_k]
        ).fetchall()
        
        if verbose:
            print(f"  Found {len(vector_results)} vector results")
        
        # 2. Full-text search
        if verbose:
            print(f"Running FTS keyword search (top {fts_top_k})...")
        
        try:
            # DuckDB FTS query using match_bm25 function
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
            fts_results = conn.execute(
                fts_query,
                [query_text, query_text, fts_top_k]
            ).fetchall()
            
            if verbose:
                print(f"  Found {len(fts_results)} FTS results")
                
        except Exception as e:
            error_msg = str(e).lower()
            if "fts_main_documents" in error_msg or "match_bm25" in error_msg or "catalog" in error_msg:
                raise RuntimeError(
                    "FTS index not found. Run create_fts_index(db_path) first."
                )
            raise
        
        # 3. Combine results
        if use_rrf:
            # Reciprocal Rank Fusion
            if verbose:
                print("Combining results using Reciprocal Rank Fusion...")
            
            vector_ranking = [r[0] for r in vector_results]  # node_ids in order
            fts_ranking = [r[0] for r in fts_results]
            
            rrf_scores = reciprocal_rank_fusion([vector_ranking, fts_ranking])
            
            # Get top_k by RRF score
            top_node_ids = [node_id for node_id, _ in rrf_scores[:top_k]]
            
            # Fetch full details for top results
            # Create a map of node_id -> result data
            result_map = {}
            for node_id, text, metadata, score in vector_results + fts_results:
                if node_id not in result_map:
                    result_map[node_id] = (text, metadata)
            
            # Build final results with RRF scores
            final_results = []
            for node_id, rrf_score in rrf_scores[:top_k]:
                if node_id in result_map:
                    text, metadata = result_map[node_id]
                    final_results.append({
                        'node_id': node_id,
                        'text': text,
                        'metadata': metadata,
                        'score': rrf_score,
                        'score_type': 'rrf'
                    })
        else:
            # Weighted score combination
            if verbose:
                print(f"Combining results with weights (vector: {vector_weight}, fts: {1-vector_weight})...")
            
            # Normalize scores to 0-1 range for each system
            def normalize_scores(results):
                if not results:
                    return []
                scores = [r[3] for r in results]
                min_score = min(scores)
                max_score = max(scores)
                score_range = max_score - min_score
                if score_range == 0:
                    return [(r[0], r[1], r[2], 1.0) for r in results]
                return [
                    (r[0], r[1], r[2], (r[3] - min_score) / score_range)
                    for r in results
                ]
            
            vector_normalized = normalize_scores(vector_results)
            fts_normalized = normalize_scores(fts_results)
            
            # Combine scores
            combined = {}
            for node_id, text, metadata, score in vector_normalized:
                combined[node_id] = {
                    'text': text,
                    'metadata': metadata,
                    'score': score * vector_weight
                }
            
            for node_id, text, metadata, score in fts_normalized:
                if node_id in combined:
                    combined[node_id]['score'] += score * (1 - vector_weight)
                else:
                    combined[node_id] = {
                        'text': text,
                        'metadata': metadata,
                        'score': score * (1 - vector_weight)
                    }
            
            # Sort by combined score and take top_k
            sorted_results = sorted(
                combined.items(),
                key=lambda x: x[1]['score'],
                reverse=True
            )[:top_k]
            
            final_results = [
                {
                    'node_id': node_id,
                    'text': data['text'],
                    'metadata': data['metadata'],
                    'score': data['score'],
                    'score_type': 'weighted'
                }
                for node_id, data in sorted_results
            ]
        
        # Optionally fetch full source documents
        if include_source_docs and final_results:
            if verbose:
                print("Fetching full source documents...")
            
            chunk_ids = [r['node_id'] for r in final_results]
            source_docs = get_source_documents(chunk_ids, db_path)
            
            # Create mapping of doc_id -> source_doc
            doc_map = {doc['doc_id']: doc for doc in source_docs}
            
            # Add source docs to results
            for result in final_results:
                # Get doc_id from chunk
                doc_id_query = """
                    SELECT doc_id FROM documents WHERE node_id = ?
                """
                doc_id_result = conn.execute(doc_id_query, [result['node_id']]).fetchone()
                
                if doc_id_result and doc_id_result[0] in doc_map:
                    result['source_doc'] = doc_map[doc_id_result[0]]
                else:
                    result['source_doc'] = None
            
            if verbose:
                docs_found = sum(1 for r in final_results if r.get('source_doc'))
                print(f"  Linked {docs_found}/{len(final_results)} chunks to source documents")
        
        return final_results
        
    finally:
        conn.close()


def print_results(results: List[Dict[str, Any]], query_text: str) -> None:
    """
    Pretty-print query results.
    
    Args:
        results: List of result dictionaries from hybrid_query
        query_text: The original query text
    """
    print(f"\nQuery: {query_text}")
    print("=" * 80)
    print(f"\nFound {len(results)} results:\n")
    
    for i, result in enumerate(results, 1):
        print(f"{i}. Score: {result['score']:.4f} ({result['score_type']})")
        print(f"   Node ID: {result['node_id']}")
        
        # Parse and display metadata
        metadata = result['metadata']
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except:
                pass
        
        if isinstance(metadata, dict):
            if 'file_name' in metadata:
                print(f"   Source: {metadata['file_name']}")
            if 'header_path' in metadata:
                print(f"   Section: {metadata['header_path']}")
        
        # Show text preview
        text = result['text']
        preview_length = 400
        if len(text) > preview_length:
            print(f"   Text Preview:\n   {text[:preview_length]}...")
        else:
            print(f"   Text:\n   {text}")
        print("-" * 80)


if __name__ == "__main__":
    import sys
    
    # Example usage
    db_path = "generated-embeddings/sqlrooms_docs.duckdb"
    
    if len(sys.argv) > 1:
        # Query with all arguments as query text
        query = " ".join(sys.argv[1:])
        print("Running hybrid search...")
        results = hybrid_query(query, db_path, verbose=True)
        print_results(results, query)
    else:
        print("Usage:")
        print("  python -m sqlrooms_rag.query 'your query here'")
        print("\nExample queries:")
        print("  python -m sqlrooms_rag.query 'How do I use DuckDB?'")
        print("  python -m sqlrooms_rag.query 'useState hook in React'")
        print("\nNote: FTS index is created automatically during prepare_embeddings()")

