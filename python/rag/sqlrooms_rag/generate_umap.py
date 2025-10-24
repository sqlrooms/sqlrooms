"""
Generate UMAP embeddings from a DuckDB embeddings database.

This module provides functionality to create 2D UMAP projections from high-dimensional
embeddings stored in DuckDB, suitable for visualization and analysis.
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Optional, List

import duckdb
import numpy as np
import pandas as pd
from sklearn.cluster import HDBSCAN
from sklearn.feature_extraction.text import TfidfVectorizer
from umap import UMAP


def extract_title_from_markdown(text: str, fallback: str = "") -> str:
    """
    Extract title from markdown frontmatter or first heading.
    
    Args:
        text: Markdown text content
        fallback: Fallback title if none found
        
    Returns:
        Extracted title or fallback
    """
    if not text or not text.strip():
        return fallback
    
    # Try to extract from YAML frontmatter
    frontmatter_match = re.match(r'^---\s*\n(.*?)\n---\s*\n', text, re.DOTALL)
    if frontmatter_match:
        frontmatter = frontmatter_match.group(1)
        # Look for title field
        title_match = re.search(r'^title:\s*["\']?([^"\'\n]+)["\']?', frontmatter, re.MULTILINE)
        if title_match:
            return title_match.group(1).strip()
    
    # Try to find first # heading
    heading_match = re.search(r'^#\s+(.+?)$', text, re.MULTILINE)
    if heading_match:
        return heading_match.group(1).strip()
    
    # Try to find any heading
    any_heading_match = re.search(r'^#{1,6}\s+(.+?)$', text, re.MULTILINE)
    if any_heading_match:
        return any_heading_match.group(1).strip()
    
    return fallback


def extract_filename_from_metadata(metadata_json: str) -> Optional[str]:
    """
    Extract filename from metadata JSON.
    
    Args:
        metadata_json: JSON string containing metadata
        
    Returns:
        Filename without extension, or None if not found
    """
    try:
        if not metadata_json:
            return None
        
        metadata = json.loads(metadata_json)
        
        # Try to get file_path or file_name
        file_path = metadata.get('file_path') or metadata.get('file_name')
        
        if file_path:
            # Extract just the filename without extension
            path = Path(file_path)
            return path.stem  # filename without extension
        
        return None
    except (json.JSONDecodeError, Exception) as e:
        print(f"Warning: Failed to parse metadata JSON: {e}", file=sys.stderr)
        return None


def load_embeddings_from_duckdb(db_path: str) -> pd.DataFrame:
    """
    Load embeddings and metadata from DuckDB.
    
    Args:
        db_path: Path to .duckdb file
        
    Returns:
        DataFrame with node_id, text, metadata_, embedding columns
    """
    print(f"📂 Loading embeddings from {db_path}...")
    
    conn = duckdb.connect(db_path, read_only=True)
    
    # Check if documents table exists
    tables = conn.execute("SHOW TABLES").fetchall()
    table_names = [t[0] for t in tables]
    
    if 'documents' not in table_names:
        raise ValueError(f"Table 'documents' not found in {db_path}. Available tables: {table_names}")
    
    # Get schema info
    schema = conn.execute("DESCRIBE documents").fetchall()
    print(f"   Schema: {len(schema)} columns")
    
    # Load data
    query = """
        SELECT 
            node_id,
            text,
            metadata_,
            embedding
        FROM documents
    """
    
    df = conn.execute(query).fetchdf()
    conn.close()
    
    print(f"✓ Loaded {len(df)} documents")
    return df


def generate_umap_embeddings(
    embeddings: np.ndarray,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
    random_state: int = 42,
) -> np.ndarray:
    """
    Generate 2D UMAP embeddings.
    
    Args:
        embeddings: Array of shape (n_samples, n_dimensions)
        n_neighbors: UMAP n_neighbors parameter
        min_dist: UMAP min_dist parameter
        random_state: Random seed for reproducibility
        
    Returns:
        Array of shape (n_samples, 2) with x, y coordinates
    """
    print(f"🗺️  Generating UMAP embeddings...")
    print(f"   n_neighbors: {n_neighbors}")
    print(f"   min_dist: {min_dist}")
    print(f"   Input shape: {embeddings.shape}")
    
    reducer = UMAP(
        n_components=2,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        random_state=random_state,
        verbose=True,
    )
    
    umap_embeddings = reducer.fit_transform(embeddings)
    
    print(f"✓ Generated UMAP embeddings: {umap_embeddings.shape}")
    return umap_embeddings


def process_embeddings(
    df: pd.DataFrame,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
    random_state: int = 42,
) -> pd.DataFrame:
    """
    Process embeddings and extract metadata.
    
    Args:
        df: DataFrame with embeddings
        n_neighbors: UMAP n_neighbors parameter
        min_dist: UMAP min_dist parameter
        random_state: Random seed
        
    Returns:
        DataFrame with title, fileName, text, x, y columns
    """
    print("🔄 Processing embeddings...")
    
    # Convert embeddings to numpy array
    print("   Converting embeddings to numpy array...")
    embeddings_list = df['embedding'].tolist()
    embeddings = np.array(embeddings_list)
    
    # Generate UMAP
    umap_coords = generate_umap_embeddings(
        embeddings,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        random_state=random_state,
    )
    
    # Extract metadata
    print("📝 Extracting metadata...")
    titles = []
    filenames = []
    
    for idx, row in df.iterrows():
        # Extract filename from metadata
        filename = extract_filename_from_metadata(row['metadata_'])
        filenames.append(filename or "Unknown")
        
        # Extract title from markdown
        title = extract_title_from_markdown(row['text'], fallback=filename or "Untitled")
        titles.append(title)
        
        if (idx + 1) % 100 == 0:
            print(f"   Processed {idx + 1}/{len(df)} documents...")
    
    # Create result DataFrame
    result_df = pd.DataFrame({
        'title': titles,
        'fileName': filenames,
        'text': df['text'].values,
        'x': umap_coords[:, 0],
        'y': umap_coords[:, 1],
    })
    
    print(f"✓ Processed {len(result_df)} documents")
    return result_df


def save_to_parquet(df: pd.DataFrame, output_path: str):
    """
    Save DataFrame to parquet file.
    
    Args:
        df: DataFrame to save
        output_path: Path to output parquet file
    """
    print(f"💾 Saving to {output_path}...")
    
    # Ensure parent directory exists
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    df.to_parquet(output_path, engine='pyarrow', compression='snappy', index=False)
    
    file_size = Path(output_path).stat().st_size
    file_size_mb = file_size / (1024 * 1024)
    
    print(f"✓ Saved {len(df)} rows to {output_path}")
    print(f"   File size: {file_size_mb:.2f} MB")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Generate UMAP embeddings from DuckDB embeddings database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate UMAP with default settings
  generate-umap-embeddings embeddings.duckdb
  
  # Custom output path
  generate-umap-embeddings embeddings.duckdb --output my_umap.parquet
  
  # Custom UMAP parameters
  generate-umap-embeddings embeddings.duckdb --n-neighbors 30 --min-dist 0.05
  
  # Preview mode (process only first N documents)
  generate-umap-embeddings embeddings.duckdb --preview 100
        """,
    )
    
    parser.add_argument(
        'input_db',
        help='Path to input .duckdb file with embeddings',
    )
    
    parser.add_argument(
        '-o', '--output',
        help='Path to output parquet file (default: input_name_umap.parquet)',
    )
    
    parser.add_argument(
        '--n-neighbors',
        type=int,
        default=15,
        help='UMAP n_neighbors parameter (default: 15)',
    )
    
    parser.add_argument(
        '--min-dist',
        type=float,
        default=0.1,
        help='UMAP min_dist parameter (default: 0.1)',
    )
    
    parser.add_argument(
        '--random-state',
        type=int,
        default=42,
        help='Random seed for reproducibility (default: 42)',
    )
    
    parser.add_argument(
        '--preview',
        type=int,
        help='Preview mode: process only first N documents',
    )
    
    args = parser.parse_args()
    
    # Validate input
    input_path = Path(args.input_db)
    if not input_path.exists():
        print(f"❌ Error: Input file not found: {args.input_db}", file=sys.stderr)
        print("\nPlease run the preparation script first:", file=sys.stderr)
        print("  prepare-embeddings ./docs -o embeddings.duckdb", file=sys.stderr)
        sys.exit(1)
    
    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = input_path.with_name(f"{input_path.stem}_umap.parquet")
    
    print("🚀 UMAP Embedding Generator")
    print("=" * 80)
    print(f"Input:  {input_path}")
    print(f"Output: {output_path}")
    print("=" * 80)
    print()
    
    try:
        # Load embeddings
        df = load_embeddings_from_duckdb(str(input_path))
        
        # Preview mode
        if args.preview:
            print(f"⚠️  Preview mode: Using first {args.preview} documents")
            df = df.head(args.preview)
        
        # Process embeddings
        result_df = process_embeddings(
            df,
            n_neighbors=args.n_neighbors,
            min_dist=args.min_dist,
            random_state=args.random_state,
        )
        
        # Save result
        save_to_parquet(result_df, str(output_path))
        
        print()
        print("=" * 80)
        print("✅ Success!")
        print("=" * 80)
        print()
        print("Sample data:")
        print(result_df.head())
        print()
        print(f"Columns: {list(result_df.columns)}")
        print(f"Shape: {result_df.shape}")
        print()
        print("Coordinate ranges:")
        print(f"  x: [{result_df['x'].min():.2f}, {result_df['x'].max():.2f}]")
        print(f"  y: [{result_df['y'].min():.2f}, {result_df['y'].max():.2f}]")
        
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

