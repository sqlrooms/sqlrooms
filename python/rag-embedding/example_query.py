#!/usr/bin/env python3
"""
Example script showing how to query the generated knowledge base.

This demonstrates loading an existing DuckDB database and performing
similarity searches to retrieve relevant information.
"""

from llama_index.core import VectorStoreIndex, StorageContext, Settings
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.duckdb import DuckDBVectorStore


def query_knowledge_base(query_text: str, database_name: str = "sqlrooms_docs"):
    """
    Query the knowledge base with a question.
    
    Args:
        query_text: The question to ask
        database_name: Name of the DuckDB database (without extension)
    """
    print(f"Loading knowledge base: {database_name}...")
    
    # Load the same embedding model used to create the knowledge base
    embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")
    
    # Configure settings
    Settings.embed_model = embed_model
    
    # Connect to the existing database
    vector_store = DuckDBVectorStore(
        database_name=database_name,
        persist_dir="./",
        embed_dim=384,
    )
    
    # Create storage context
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    
    # Load the index from the vector store
    print("Loading index...")
    index = VectorStoreIndex.from_vector_store(
        vector_store,
    )
    
    # Create retriever (no LLM needed for retrieval)
    retriever = index.as_retriever(similarity_top_k=3)
    
    # Query the knowledge base
    print(f"\nQuery: {query_text}")
    print("-" * 80)
    
    # Retrieve relevant chunks
    nodes = retriever.retrieve(query_text)
    
    print(f"\nRetrieved {len(nodes)} relevant chunks:")
    print("-" * 80)
    
    for i, node in enumerate(nodes, 1):
        print(f"\n{i}. Similarity Score: {node.score:.4f}")
        print(f"   Text:\n   {node.text[:500]}...")
        if node.metadata:
            print(f"   Source: {node.metadata.get('file_name', 'Unknown')}")


if __name__ == "__main__":
    # Example queries about SQLRooms
    queries = [
        "What is SQLRooms?",
        "How do I get started with SQLRooms?",
        "What visualization libraries does SQLRooms support?",
    ]
    
    for query in queries:
        print("\n" + "=" * 80)
        query_knowledge_base(query)
        print("=" * 80 + "\n")

