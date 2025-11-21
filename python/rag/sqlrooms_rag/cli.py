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
  
  # Increase header weight for better header-based retrieval
  %(prog)s docs -o generated-embeddings/kb.duckdb --header-weight 5
  
  # Use a different embedding model
  %(prog)s docs -o generated-embeddings/kb.duckdb --model "sentence-transformers/all-MiniLM-L6-v2" --embed-dim 384
  
  # Use OpenAI embeddings (requires API key)
  %(prog)s docs -o generated-embeddings/kb.duckdb --provider openai --api-key YOUR_API_KEY
  
  # Use OpenAI with environment variable OPENAI_API_KEY
  export OPENAI_API_KEY=your_key_here
  %(prog)s docs -o generated-embeddings/kb.duckdb --provider openai
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
        "--provider",
        dest="embedding_provider",
        choices=["huggingface", "openai"],
        default="huggingface",
        help="Embedding provider: 'huggingface' (local, free) or 'openai' (API, paid). Default: huggingface",
    )
    
    parser.add_argument(
        "--model",
        dest="embed_model_name",
        default=None,
        help="Embedding model name. Defaults: huggingface='BAAI/bge-small-en-v1.5', openai='text-embedding-3-small'",
    )
    
    parser.add_argument(
        "--embed-dim",
        type=int,
        default=None,
        help="Embedding dimension size. Auto-detected if not specified. Common: bge-small=384, openai-small=1536",
    )
    
    parser.add_argument(
        "--api-key",
        dest="api_key",
        default=None,
        help="API key for external providers (e.g., OpenAI). Can also use OPENAI_API_KEY environment variable.",
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
    
    parser.add_argument(
        "--header-weight",
        type=int,
        default=3,
        help="Number of times to repeat headers in chunks for higher weight (default: 3, min: 1)",
    )
    
    args = parser.parse_args()
    
    try:
        prepare_embeddings(
            input_dir=args.input_dir,
            output_db=args.output_db,
            chunk_size=args.chunk_size,
            embed_model_name=args.embed_model_name,
            embed_dim=args.embed_dim,
            embedding_provider=args.embedding_provider,
            api_key=args.api_key,
            verbose=not args.quiet,
            use_markdown_chunking=not args.no_markdown_chunking,
            include_headers_in_chunks=not args.no_header_weighting,
            header_weight=args.header_weight,
        )
    except KeyboardInterrupt:
        print("\n\nInterrupted by user.", file=sys.stderr)
        sys.exit(130)
    except (FileNotFoundError, ValueError, ImportError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

