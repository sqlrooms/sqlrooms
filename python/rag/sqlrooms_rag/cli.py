#!/usr/bin/env python3
"""
Command-line interface for SQLRooms RAG embedding tools.
"""

import argparse
import sys

from .prepare import prepare_embeddings


def main():
    """CLI entry point for prepare-embeddings command."""
    parser = argparse.ArgumentParser(
        description="Prepare embeddings from markdown files and store in DuckDB",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage - process docs folder and create knowledge_base.duckdb
  %(prog)s docs -o generated-embeddings/knowledge_base.duckdb
  
  # Use custom chunk size
  %(prog)s docs -o generated-embeddings/kb.duckdb --chunk-size 256
  
  # Use a different embedding model
  %(prog)s docs -o generated-embeddings/kb.duckdb --model "sentence-transformers/all-MiniLM-L6-v2" --embed-dim 384
        """,
    )
    
    parser.add_argument(
        "input_dir",
        help="Directory containing markdown (.md) files to process",
    )
    
    parser.add_argument(
        "-o",
        "--output",
        dest="output_db",
        default="generated-embeddings/knowledge_base.duckdb",
        help="Output DuckDB database file path (default: generated-embeddings/knowledge_base.duckdb)",
    )
    
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=512,
        help="Size of text chunks in tokens (default: 512)",
    )
    
    parser.add_argument(
        "--model",
        dest="embed_model_name",
        default="BAAI/bge-small-en-v1.5",
        help="HuggingFace embedding model name (default: BAAI/bge-small-en-v1.5)",
    )
    
    parser.add_argument(
        "--embed-dim",
        type=int,
        default=384,
        help="Embedding dimension size (default: 384 for bge-small-en-v1.5)",
    )
    
    parser.add_argument(
        "-q",
        "--quiet",
        action="store_true",
        help="Suppress progress messages",
    )
    
    parser.add_argument(
        "--no-markdown-chunking",
        action="store_true",
        help="Disable markdown-aware chunking (use simple size-based chunking instead)",
    )
    
    parser.add_argument(
        "--no-header-weighting",
        action="store_true",
        help="Disable prepending headers to chunks (reduces header weight in embeddings)",
    )
    
    args = parser.parse_args()
    
    try:
        prepare_embeddings(
            input_dir=args.input_dir,
            output_db=args.output_db,
            chunk_size=args.chunk_size,
            embed_model_name=args.embed_model_name,
            embed_dim=args.embed_dim,
            verbose=not args.quiet,
            use_markdown_chunking=not args.no_markdown_chunking,
            include_headers_in_chunks=not args.no_header_weighting,
        )
    except KeyboardInterrupt:
        print("\n\nInterrupted by user.", file=sys.stderr)
        sys.exit(130)
    except (FileNotFoundError, ValueError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

