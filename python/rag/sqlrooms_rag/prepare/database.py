"""
Database operations for storing source documents and creating indexes.
"""

import json
from pathlib import Path

import duckdb


def create_source_documents_table(
    db_path: Path, documents: list, verbose: bool = True
) -> None:
    """
    Create a table storing original source documents before chunking.

    This allows retrieving full document context after finding relevant chunks.
    Each chunk in the main documents table will reference its source document.

    Args:
        db_path: Full path to the DuckDB database file
        documents: List of llama-index Document objects
        verbose: Whether to print progress messages
    """
    if verbose:
        print("Creating source documents table...")

    conn = duckdb.connect(str(db_path))

    try:
        # Create table for original source documents
        conn.execute("""
            CREATE TABLE IF NOT EXISTS source_documents (
                doc_id VARCHAR PRIMARY KEY,
                file_path VARCHAR,
                file_name VARCHAR,
                text TEXT,
                metadata_ JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Insert source documents
        for doc in documents:
            # Extract metadata
            metadata = doc.metadata if hasattr(doc, "metadata") else {}
            doc_id = doc.doc_id if hasattr(doc, "doc_id") else str(hash(doc.text))
            file_path = metadata.get("file_path", "")
            file_name = metadata.get("file_name", "")

            conn.execute(
                """
                INSERT INTO source_documents (doc_id, file_path, file_name, text, metadata_)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (doc_id) DO UPDATE SET
                    text = EXCLUDED.text,
                    metadata_ = EXCLUDED.metadata_
            """,
                [doc_id, file_path, file_name, doc.text, json.dumps(metadata)],
            )

        if verbose:
            count = conn.execute("SELECT COUNT(*) FROM source_documents").fetchone()[0]
            print(f"✓ Stored {count} source documents")

    finally:
        conn.close()


def add_document_references(db_path: Path, nodes: list, verbose: bool = True) -> None:
    """
    Add source document references to chunk nodes.

    Updates the documents table to add doc_id column linking chunks
    to their source documents.

    Args:
        db_path: Full path to the DuckDB database file
        nodes: List of llama-index Node objects (chunks)
        verbose: Whether to print progress messages
    """
    if verbose:
        print("Adding source document references to chunks...")

    conn = duckdb.connect(str(db_path))

    try:
        # Add doc_id column if it doesn't exist
        try:
            conn.execute("""
                ALTER TABLE documents 
                ADD COLUMN doc_id VARCHAR
            """)
        except Exception:
            # Column might already exist
            pass

        # Update chunks with their source document IDs
        for node in nodes:
            if hasattr(node, "node_id") and hasattr(node, "ref_doc_id"):
                conn.execute(
                    """
                    UPDATE documents 
                    SET doc_id = ?
                    WHERE node_id = ?
                """,
                    [node.ref_doc_id, node.node_id],
                )

        if verbose:
            count = conn.execute(
                "SELECT COUNT(*) FROM documents WHERE doc_id IS NOT NULL"
            ).fetchone()[0]
            print(f"✓ Linked {count} chunks to source documents")

    finally:
        conn.close()


def create_fts_index(db_path: Path, verbose: bool = True) -> None:
    """
    Create full-text search index on the documents table.

    This enables hybrid retrieval combining vector similarity with keyword search.
    The FTS index is created on the chunked text for fast keyword matching.

    Args:
        db_path: Full path to the DuckDB database file
        verbose: Whether to print progress messages
    """
    if verbose:
        print("Creating full-text search index...")

    conn = duckdb.connect(str(db_path))

    try:
        # Load FTS extension
        conn.execute("INSTALL fts;")
        conn.execute("LOAD fts;")

        # Create FTS index
        conn.execute("""
            PRAGMA create_fts_index(
                'documents',
                'node_id',
                'text',
                stemmer = 'porter',
                stopwords = 'english',
                ignore = '(\\.|[^a-z])+',
                strip_accents = 1,
                lower = 1,
                overwrite = 1
            )
        """)

        if verbose:
            print("✓ Full-text search index created")

    except Exception as e:
        if verbose:
            print(f"Warning: Could not create FTS index: {e}")
            print("Hybrid search will not be available.")
    finally:
        conn.close()
