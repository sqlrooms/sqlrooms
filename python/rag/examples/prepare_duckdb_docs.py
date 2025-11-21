#!/usr/bin/env python3
"""
Download DuckDB documentation and prepare embeddings.

This script:
1. Downloads DuckDB docs from GitHub using degit
2. Prepares embeddings using the sqlrooms-rag package
3. Outputs a DuckDB database with vector embeddings

Requirements:
- Node.js (for npx degit)
- sqlrooms-rag package installed
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from sqlrooms_rag import prepare_embeddings
except ImportError:
    print("Error: sqlrooms-rag package not installed.", file=sys.stderr)
    print("Install it with: pip install sqlrooms-rag", file=sys.stderr)
    sys.exit(1)


def download_duckdb_docs(output_dir: str, version: str = "stable") -> Path:
    """
    Download DuckDB documentation using degit.
    
    Args:
        output_dir: Directory to download docs to
        version: Documentation version (default: "stable")
    
    Returns:
        Path to downloaded documentation
    """
    docs_path = Path(output_dir)
    
    # Check if docs already exist
    if docs_path.exists():
        response = input(f"Directory {docs_path} already exists. Delete and re-download? [y/N] ")
        if response.lower() == 'y':
            print(f"Removing {docs_path}...")
            shutil.rmtree(docs_path)
        else:
            print("Using existing documentation.")
            return docs_path
    
    # Download using degit
    repo_path = f"duckdb/duckdb-web/docs/{version}"
    print(f"Downloading DuckDB documentation from GitHub...")
    print(f"Repository: {repo_path}")
    
    try:
        # Check if npx is available
        subprocess.run(
            ["npx", "--version"],
            check=True,
            capture_output=True,
            text=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: npx not found. Please install Node.js.", file=sys.stderr)
        print("Visit: https://nodejs.org/", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Run degit to download the docs
        result = subprocess.run(
            ["npx", "degit", repo_path, str(docs_path)],
            check=True,
            capture_output=True,
            text=True,
        )
        print(result.stdout)
        print(f"✓ Downloaded documentation to {docs_path}")
    except subprocess.CalledProcessError as e:
        print(f"Error downloading documentation: {e}", file=sys.stderr)
        print(e.stderr, file=sys.stderr)
        sys.exit(1)
    
    # Count markdown files
    md_files = list(docs_path.glob("**/*.md"))
    print(f"Found {len(md_files)} markdown files")
    
    return docs_path


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Download DuckDB documentation and prepare embeddings",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Download docs and create embeddings with defaults
  %(prog)s
  
  # Specify output paths
  %(prog)s --docs-dir ./duckdb-docs --output ./embeddings/duckdb.duckdb
  
  # Use custom embedding model
  %(prog)s --model "sentence-transformers/all-MiniLM-L6-v2" --embed-dim 384
  
  # Skip download if docs already exist
  %(prog)s --skip-download --docs-dir ./duckdb-docs
        """,
    )
    
    parser.add_argument(
        "--docs-dir",
        default="./downloaded-docs/duckdb",
        help="Directory to download/read DuckDB docs (default: ./downloaded-docs/duckdb)",
    )
    
    parser.add_argument(
        "--version",
        default="stable",
        help="DuckDB docs version to download (default: stable)",
    )
    
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Skip download and use existing docs in --docs-dir",
    )
    
    parser.add_argument(
        "-o",
        "--output",
        default="./generated-embeddings/duckdb_docs.duckdb",
        help="Output DuckDB database file (default: ./generated-embeddings/duckdb_docs.duckdb)",
    )
    
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=512,
        help="Size of text chunks in tokens (default: 512)",
    )
    
    parser.add_argument(
        "--model",
        default="BAAI/bge-small-en-v1.5",
        help="HuggingFace embedding model (default: BAAI/bge-small-en-v1.5)",
    )
    
    parser.add_argument(
        "--embed-dim",
        type=int,
        default=384,
        help="Embedding dimension size (default: 384)",
    )
    
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove downloaded docs after processing",
    )
    
    args = parser.parse_args()
    
    try:
        # Step 1: Download documentation
        if args.skip_download:
            docs_path = Path(args.docs_dir)
            if not docs_path.exists():
                print(f"Error: Documentation directory {docs_path} does not exist.", file=sys.stderr)
                print("Run without --skip-download to download docs.", file=sys.stderr)
                sys.exit(1)
            print(f"Using existing documentation in {docs_path}")
        else:
            docs_path = download_duckdb_docs(args.docs_dir, args.version)
        
        # Step 2: Prepare embeddings
        print("\n" + "=" * 80)
        print("Preparing embeddings...")
        print("=" * 80 + "\n")
        
        prepare_embeddings(
            input_dir=str(docs_path),
            output_db=args.output,
            chunk_size=args.chunk_size,
            embed_model_name=args.model,
            embed_dim=args.embed_dim,
            verbose=True,
        )
        
        # Step 3: Clean up if requested
        if args.clean:
            print(f"\nCleaning up: removing {docs_path}")
            shutil.rmtree(docs_path)
        
        print("\n" + "=" * 80)
        print("✓ DuckDB documentation embeddings ready!")
        print(f"✓ Database: {args.output}")
        print("=" * 80)
        
        # Show example usage
        print("\nExample usage in TypeScript:")
        print("""
import {createRagSlice} from '@sqlrooms/rag';

const store = createRoomStore({
  slices: [
    createDuckDbSlice(),
    createRagSlice({
      embeddingsDatabases: [
        {
          databaseFilePathOrUrl: './embeddings/duckdb_docs.duckdb',
          databaseName: 'duckdb_docs',
        },
      ],
    }),
  ],
});

// Query the documentation
const results = await store.getState().rag.queryEmbeddings(embedding, {
  topK: 5,
});
        """)
        
    except KeyboardInterrupt:
        print("\n\nInterrupted by user.", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

