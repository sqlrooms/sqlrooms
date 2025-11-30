#!/usr/bin/env python3
"""
Example: Programmatic UMAP Generation

This example shows how to use the sqlrooms_rag API to generate UMAP embeddings
programmatically instead of using the CLI.
"""

from pathlib import Path

from sqlrooms_rag import (
    load_embeddings_from_duckdb,
    process_embeddings,
    save_to_parquet,
)


def main():
    """Generate UMAP embeddings programmatically."""
    
    # Input/output paths
    db_path = "generated-embeddings/duckdb_docs.duckdb"
    output_path = "generated-embeddings/duckdb_docs_umap.parquet"
    
    # Check if input exists
    if not Path(db_path).exists():
        print(f"❌ Error: {db_path} not found!")
        print("Run prepare_duckdb_docs.py first to generate embeddings.")
        return
    
    print("🚀 Generating UMAP embeddings programmatically")
    print("=" * 80)
    
    # 1. Load embeddings from DuckDB
    print(f"\n📂 Loading embeddings from {db_path}...")
    df = load_embeddings_from_duckdb(db_path)
    print(f"✓ Loaded {len(df)} documents")
    
    # 2. Process embeddings and generate UMAP
    print("\n🗺️  Generating UMAP projection...")
    result_df = process_embeddings(
        df,
        n_neighbors=15,  # Balance local and global structure
        min_dist=0.1,    # Moderate spacing
        random_state=42, # For reproducibility
    )
    
    # 3. Save to parquet
    print("\n💾 Saving results...")
    save_to_parquet(result_df, output_path)
    
    print("\n" + "=" * 80)
    print("✅ Success!")
    print("=" * 80)
    
    # 4. Show sample results
    print("\nSample data:")
    print(result_df.head())
    
    print(f"\n📊 Output file: {output_path}")
    print(f"   Rows: {len(result_df)}")
    print(f"   Columns: {list(result_df.columns)}")
    print(f"\n   X range: [{result_df['x'].min():.2f}, {result_df['x'].max():.2f}]")
    print(f"   Y range: [{result_df['y'].min():.2f}, {result_df['y'].max():.2f}]")


if __name__ == "__main__":
    main()

