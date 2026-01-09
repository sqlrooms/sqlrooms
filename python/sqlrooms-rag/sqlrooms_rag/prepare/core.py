"""
Core orchestration logic for preparing embeddings from markdown files.
"""

from pathlib import Path
from typing import Optional, Literal

from llama_index.core import (
    StorageContext,
    VectorStoreIndex,
    SimpleDirectoryReader,
    Settings,
)
from llama_index.core.node_parser import MarkdownNodeParser
from llama_index.vector_stores.duckdb import DuckDBVectorStore

from .chunking import count_tokens, validate_and_split_chunks
from .embeddings import get_embedding_model
from .database import (
    create_source_documents_table,
    add_document_references,
    create_fts_index,
)
from .metadata import create_metadata, store_metadata_in_db, save_metadata_yaml


def prepare_embeddings(
    input_dir: str,
    output_db: str,
    chunk_size: int = 512,
    embed_model_name: Optional[str] = None,
    embed_dim: Optional[int] = None,
    embedding_provider: Literal["huggingface", "openai"] = "huggingface",
    api_key: Optional[str] = None,
    verbose: bool = True,
    use_markdown_chunking: bool = True,
    include_headers_in_chunks: bool = True,
    header_weight: int = 3,
    overwrite: bool = False,
):
    """
    Prepare embeddings from markdown files and store in DuckDB.

    Args:
        input_dir: Directory containing .md files to process
        output_db: Path to output DuckDB database file (without extension)
        chunk_size: Size of text chunks in tokens (default: 512)
        embed_model_name: Model name. Defaults depend on provider:
            - huggingface: "BAAI/bge-small-en-v1.5"
            - openai: "text-embedding-3-small"
        embed_dim: Embedding dimension. If None, auto-detected from model.
            Common values:
            - BAAI/bge-small-en-v1.5: 384
            - text-embedding-3-small: 1536
            - text-embedding-3-large: 3072
        embedding_provider: "huggingface" (local, free) or "openai" (API, paid)
        api_key: API key for external providers (required for OpenAI).
            Can also be set via OPENAI_API_KEY environment variable.
        verbose: Whether to print progress messages (default: True)
        use_markdown_chunking: Use markdown-aware chunking by headers (default: True)
        include_headers_in_chunks: Prepend headers to chunk text for higher weight (default: True)
        header_weight: Number of times to repeat headers in chunks (default: 3, min: 1)
        overwrite: If True, overwrite existing database. If False, exit with error if database exists. (default: False)

    Returns:
        VectorStoreIndex: The created knowledge base index

    Raises:
        FileNotFoundError: If input directory doesn't exist
        FileExistsError: If database exists and overwrite=False
        ValueError: If no markdown files found in input directory or API key missing
        ImportError: If required package for provider is not installed
    """
    input_path = Path(input_dir)

    # Validate input directory
    if not input_path.exists():
        raise FileNotFoundError(f"Input directory '{input_dir}' does not exist.")

    if not input_path.is_dir():
        raise ValueError(f"'{input_dir}' is not a directory.")

    # Check for markdown files
    md_files = list(input_path.glob("**/*.md"))
    if not md_files:
        raise ValueError(f"No .md files found in '{input_dir}'.")

    if verbose:
        print(f"Found {len(md_files)} markdown file(s) in '{input_dir}'")

    # Check if output database already exists BEFORE doing any expensive work
    output_path = Path(output_db)
    if output_path.suffix == ".duckdb":
        full_db_path = output_path
    else:
        full_db_path = Path(str(output_path) + ".duckdb")

    if full_db_path.exists():
        if not overwrite:
            raise FileExistsError(
                f"Database already exists: {full_db_path}\n"
                f"Use --overwrite flag to replace it, or choose a different output path."
            )
        if verbose:
            print(f"⚠ Will overwrite existing database: {full_db_path}")

    # Initialize the embedding model
    embed_model, embed_dim = get_embedding_model(
        provider=embedding_provider,
        model_name=embed_model_name,
        api_key=api_key,
        embed_dim=embed_dim,
        verbose=verbose,
    )

    # Load documents from the input directory
    if verbose:
        print(f"Loading documents from '{input_dir}'...")
    documents = SimpleDirectoryReader(
        input_dir=str(input_path),
        required_exts=[".md"],
        recursive=True,
    ).load_data()

    if verbose:
        print(f"Loaded {len(documents)} document(s)")

    # Configure global settings
    Settings.embed_model = embed_model
    Settings.chunk_size = chunk_size

    # Note about OpenAI limits
    if embedding_provider == "openai" and verbose:
        print(f"Using chunk_size={chunk_size} (OpenAI limit: 8192 tokens per request)")
        print("Oversized chunks will be automatically split if needed")

    # Parse documents into nodes using markdown-aware chunking
    if use_markdown_chunking:
        if verbose:
            print("Using markdown-aware chunking (splits by headers and sections)...")

        # Create markdown parser that respects document structure
        # include_metadata=True stores headers in metadata
        # include_prev_next_rel=True adds context about surrounding chunks
        markdown_parser = MarkdownNodeParser(
            include_metadata=True,
            include_prev_next_rel=True,
        )
        nodes = markdown_parser.get_nodes_from_documents(documents)

        # For external APIs: validate and split oversized chunks
        # OpenAI has 8192 token limit, we use 5000 for extra safety
        # (token estimation isn't perfect, better safe than sorry)
        if embedding_provider == "openai":
            if verbose:
                print("Validating chunk sizes for OpenAI (API limit: 8192 tokens)...")
            nodes = validate_and_split_chunks(nodes, max_tokens=5000, verbose=verbose)

        # Prepend header hierarchy to each chunk to give headers more weight
        if include_headers_in_chunks:
            # Ensure header_weight is at least 1
            weight = max(1, header_weight)

            # Warn about high header weights with external APIs
            if embedding_provider == "openai" and weight > 2 and verbose:
                print(f"Warning: header_weight={weight} may create large chunks")
                print(
                    "         (chunks will be auto-split if they exceed OpenAI's 8192 token limit)"
                )

            headers_added = 0

            for node in nodes:
                # Get header from metadata if available
                header_text = ""
                if hasattr(node, "metadata") and node.metadata:
                    # Common metadata fields that might contain headers
                    if "header_path" in node.metadata:
                        header_text = node.metadata["header_path"]
                    elif "section_header" in node.metadata:
                        header_text = node.metadata["section_header"]

                # Repeat header multiple times to increase its weight in embeddings
                if header_text and not node.text.startswith(header_text):
                    # Repeat the header 'weight' times, separated by newlines
                    repeated_header = "\n".join([header_text] * weight) + "\n\n"
                    node.text = repeated_header + node.text
                    headers_added += 1

            if verbose and headers_added > 0:
                weight_msg = f" (weight: {weight}x)" if weight > 1 else ""
                print(
                    f"Enhanced {headers_added} chunks with header context{weight_msg} for better retrieval"
                )

        if verbose:
            print(f"Created {len(nodes)} chunks from markdown sections")
    else:
        if verbose:
            print("Using default size-based chunking...")
        nodes = None  # Let VectorStoreIndex do default chunking

    # Set up DuckDB vector store
    output_path = Path(output_db)

    # Handle directory and database name
    # DuckDB doesn't automatically add .duckdb extension, so we handle it explicitly
    if output_path.suffix == ".duckdb":
        # User provided full path with .duckdb extension
        persist_dir = (
            output_path.parent if output_path.parent != Path(".") else Path(".")
        )
        database_name = output_path.name  # Keep full name with .duckdb
    else:
        # User provided path without extension - add .duckdb
        persist_dir = (
            output_path.parent if output_path.parent != Path(".") else Path(".")
        )
        database_name = output_path.name + ".duckdb"

    # Ensure persist_dir exists
    if persist_dir != Path("."):
        persist_dir.mkdir(parents=True, exist_ok=True)

    # Delete existing database if overwrite=True (we already checked existence earlier)
    full_db_path = (
        persist_dir / database_name if persist_dir != Path(".") else Path(database_name)
    )
    if overwrite and full_db_path.exists():
        if verbose:
            print(f"Removing existing database: {full_db_path}")
        full_db_path.unlink()

    if verbose:
        print(f"Creating DuckDB vector store: {persist_dir}/{database_name}")

    vector_store = DuckDBVectorStore(
        database_name=database_name,
        persist_dir=str(persist_dir),
        embed_dim=embed_dim,
    )

    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    # Create the knowledge base by generating and storing embeddings
    if verbose:
        print("Generating embeddings and building knowledge base...")
        if nodes:
            num_chunks = len(nodes)
            num_batches = (
                num_chunks + 2047
            ) // 2048  # Calculate number of 2048-sized batches
            print(
                f"Processing {num_chunks} chunks in {num_batches} batch(es) of up to 2048 chunks each"
            )
            if num_batches > 1:
                print("(Progress bar will reset for each batch)")
        print("(This may take a while depending on the number and size of documents)")

    try:
        if nodes:
            # Use pre-parsed nodes
            knowledge_base = VectorStoreIndex(
                nodes,
                storage_context=storage_context,
                show_progress=verbose,
            )
        else:
            # Use default document parsing
            knowledge_base = VectorStoreIndex.from_documents(
                documents,
                storage_context=storage_context,
                show_progress=verbose,
            )
    except Exception as e:
        error_msg = str(e)

        # Check if this is a token limit error
        if (
            "maximum context length" in error_msg.lower()
            and "tokens" in error_msg.lower()
        ):
            print("\n" + "=" * 80)
            print("ERROR: OpenAI Token Limit Exceeded")
            print("=" * 80)
            print(f"\n{error_msg}\n")

            # Try to find the problematic chunk(s)
            print("Analyzing chunks to find the problematic one(s)...\n")

            if nodes:
                oversized = []
                for i, node in enumerate(nodes):
                    text = node.text if hasattr(node, "text") else str(node)
                    tokens = count_tokens(text)
                    # Check against a conservative threshold
                    if tokens > 5000:
                        oversized.append((i, node, text, tokens))

                if oversized:
                    print(f"Found {len(oversized)} chunk(s) that may be too large:\n")
                    for idx, (i, node, text, tokens) in enumerate(
                        oversized[:5], 1
                    ):  # Show first 5
                        print(f"\nProblematic Chunk #{idx}:")
                        print(f"  Index: {i}")
                        print(f"  Estimated tokens: {tokens}")
                        print(f"  Character length: {len(text)}")

                        # Show metadata
                        if hasattr(node, "metadata") and node.metadata:
                            print(f"  Metadata: {node.metadata}")

                        # Show text preview
                        print("  Text preview (first 500 chars):")
                        print(f"  {'-' * 76}")
                        print(f"  {text[:500]}")
                        print(f"  {'-' * 76}")

                        # Show text end
                        if len(text) > 500:
                            print(f"  ... ({len(text) - 1000} chars omitted) ...")
                            print("  Text preview (last 500 chars):")
                            print(f"  {'-' * 76}")
                            print(f"  {text[-500:]}")
                            print(f"  {'-' * 76}")

                        # Save full chunk to file for inspection
                        problem_file = full_db_path.parent / f"problem_chunk_{i}.txt"
                        try:
                            with open(problem_file, "w") as f:
                                f.write(f"Chunk Index: {i}\n")
                                f.write(f"Estimated Tokens: {tokens}\n")
                                f.write(f"Character Length: {len(text)}\n")
                                f.write(
                                    f"Metadata: {node.metadata if hasattr(node, 'metadata') else 'None'}\n"
                                )
                                f.write(f"\n{'=' * 80}\n")
                                f.write("FULL TEXT:\n")
                                f.write(f"{'=' * 80}\n\n")
                                f.write(text)
                            print(f"\n  ✓ Full chunk saved to: {problem_file}")
                        except Exception as save_error:
                            print(f"\n  ✗ Could not save chunk: {save_error}")

                    if len(oversized) > 5:
                        print(f"\n... and {len(oversized) - 5} more oversized chunks")

                    print("\n" + "=" * 80)
                    print("SOLUTIONS:")
                    print("=" * 80)
                    print(
                        "\nThe splitting logic couldn't break these chunks down enough."
                    )
                    print("This usually happens with:")
                    print("  - Very long tables")
                    print("  - Large code blocks")
                    print("  - Continuous text without sentence breaks")
                    print("\nTry these solutions:")
                    print("\n1. Use even smaller chunk size:")
                    print("   --chunk-size 64")
                    print("\n2. Disable markdown chunking (use size-based):")
                    print("   --chunk-size 256 --no-markdown-chunking")
                    print("\n3. Preprocess the source markdown files:")
                    print("   - Break up very long tables")
                    print("   - Split large code blocks")
                    print("   - Add section breaks in continuous text")
                    print("\n4. Manual inspection:")
                    print("   - Check the saved problem_chunk_*.txt files")
                    print("   - Identify the source document")
                    print("   - Edit or exclude that document")
                    print()
                else:
                    print(
                        "Could not identify oversized chunks (they may have been missed by validation)"
                    )

            raise
        else:
            # Different error, re-raise with original traceback
            raise

    # Get the full database path
    full_db_path = (
        persist_dir / database_name if persist_dir != Path(".") else Path(database_name)
    )

    # Store original source documents
    create_source_documents_table(
        db_path=full_db_path, documents=documents, verbose=verbose
    )

    # Link chunks to source documents
    if nodes:
        add_document_references(db_path=full_db_path, nodes=nodes, verbose=verbose)

    # Create full-text search index for hybrid retrieval
    create_fts_index(db_path=full_db_path, verbose=verbose)

    # Create and store metadata
    metadata = create_metadata(
        documents=documents,
        nodes=nodes if nodes else [],
        embedding_provider=embedding_provider,
        embed_model_name=embed_model_name
        if embed_model_name
        else (
            "BAAI/bge-small-en-v1.5"
            if embedding_provider == "huggingface"
            else "text-embedding-3-small"
        ),
        embed_dim=embed_dim,
        chunk_size=chunk_size,
        use_markdown_chunking=use_markdown_chunking,
        include_headers_in_chunks=include_headers_in_chunks,
        header_weight=header_weight,
    )

    # Store metadata in database
    store_metadata_in_db(db_path=full_db_path, metadata=metadata, verbose=verbose)

    # Save metadata as YAML file
    save_metadata_yaml(db_path=full_db_path, metadata=metadata, verbose=verbose)

    if verbose:
        print(f"\n{'=' * 80}")
        print("✓ Knowledge base created successfully!")
        print(f"{'=' * 80}")
        print(f"Database: {persist_dir}/{database_name}")
        print(f"Metadata: {database_name.replace('.duckdb', '.yaml')}")
        print()
        print("Embedding Model:")
        print(f"  Provider: {metadata['embedding']['provider']}")
        print(f"  Model: {metadata['embedding']['model']}")
        print(f"  Dimensions: {metadata['embedding']['dimensions']}")
        print()
        print("Documents:")
        print(f"  Source documents: {metadata['source_documents']['total_documents']}")
        print(f"  Total chunks: {metadata['chunks']['total_chunks']}")
        print(
            f"  Chunk size range: {metadata['chunks']['min_chunk_size']}-{metadata['chunks']['max_chunk_size']} characters"
        )
        print(
            f"  Median chunk size: {metadata['chunks']['median_chunk_size']} characters"
        )
        print()
        print("Features:")
        print("  ✓ Vector similarity search")
        print("  ✓ Full-text search (BM25)")
        print("  ✓ Hybrid retrieval (RRF)")
        print("  ✓ Source documents stored")
        print("  ✓ Metadata tracking")
        print("\nYou can now use this database for RAG applications.")
        print(f"{'=' * 80}")

    return knowledge_base
