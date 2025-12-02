/**
 * Database operations for RAG document storage.
 * Mirrors: python/rag/sqlrooms_rag/prepare/database.py
 */

import type {DuckDbConnector} from '@sqlrooms/duckdb';

/**
 * Escape SQL string to prevent injection.
 */
function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * Create the documents table schema for storing embeddings.
 */
export async function createDocumentsTable(
  connector: DuckDbConnector,
  databaseName: string,
  embeddingDimensions: number,
): Promise<void> {
  await connector.query(`
    CREATE TABLE IF NOT EXISTS ${databaseName}.documents (
      node_id VARCHAR PRIMARY KEY,
      text TEXT,
      metadata_ JSON,
      embedding FLOAT[${embeddingDimensions}],
      doc_id VARCHAR,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Create source documents table for storing original full documents.
 */
export async function createSourceDocumentsTable(
  connector: DuckDbConnector,
  databaseName: string,
): Promise<void> {
  await connector.query(`
    CREATE TABLE IF NOT EXISTS ${databaseName}.source_documents (
      doc_id VARCHAR PRIMARY KEY,
      file_path VARCHAR,
      file_name VARCHAR,
      text TEXT,
      metadata_ JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Create embedding metadata table.
 */
export async function createMetadataTable(
  connector: DuckDbConnector,
  databaseName: string,
): Promise<void> {
  await connector.query(`
    CREATE TABLE IF NOT EXISTS ${databaseName}.embedding_metadata (
      key VARCHAR PRIMARY KEY,
      value VARCHAR,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Create full-text search index for hybrid retrieval.
 * Note: FTS doesn't work with attached in-memory databases in DuckDB-WASM.
 * This is a no-op - vector search is used instead.
 */
export async function createFtsIndex(
  _connector: DuckDbConnector,
  _databaseName: string,
): Promise<void> {
  // FTS disabled - doesn't work with attached in-memory databases
}

/**
 * Document to insert.
 */
export type InsertDocumentParams = {
  nodeId: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  docId?: string;
};

/**
 * Insert a document chunk with embedding.
 */
export async function insertDocument(
  connector: DuckDbConnector,
  databaseName: string,
  doc: InsertDocumentParams,
): Promise<void> {
  const embeddingLiteral = `[${doc.embedding.join(', ')}]`;
  const embeddingDim = doc.embedding.length;

  await connector.query(`
    INSERT INTO ${databaseName}.documents (node_id, text, metadata_, embedding, doc_id)
    VALUES (
      '${escapeSQL(doc.nodeId)}',
      '${escapeSQL(doc.text)}',
      '${escapeSQL(JSON.stringify(doc.metadata || {}))}',
      ${embeddingLiteral}::FLOAT[${embeddingDim}],
      ${doc.docId ? `'${escapeSQL(doc.docId)}'` : 'NULL'}
    )
    ON CONFLICT (node_id) DO UPDATE SET
      text = EXCLUDED.text,
      metadata_ = EXCLUDED.metadata_,
      embedding = EXCLUDED.embedding
  `);
}

/**
 * Source document to insert.
 */
export type InsertSourceDocumentParams = {
  docId: string;
  text: string;
  filePath?: string;
  fileName?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Insert a source document (full, unchunked).
 */
export async function insertSourceDocument(
  connector: DuckDbConnector,
  databaseName: string,
  doc: InsertSourceDocumentParams,
): Promise<void> {
  await connector.query(`
    INSERT INTO ${databaseName}.source_documents (doc_id, file_path, file_name, text, metadata_)
    VALUES (
      '${escapeSQL(doc.docId)}',
      '${escapeSQL(doc.filePath || '')}',
      '${escapeSQL(doc.fileName || '')}',
      '${escapeSQL(doc.text)}',
      '${escapeSQL(JSON.stringify(doc.metadata || {}))}'
    )
    ON CONFLICT (doc_id) DO UPDATE SET
      text = EXCLUDED.text,
      metadata_ = EXCLUDED.metadata_
  `);
}

/**
 * Initialize a complete RAG database schema.
 */
export async function initializeRagSchema(
  connector: DuckDbConnector,
  databaseName: string,
  embeddingDimensions: number,
): Promise<void> {
  await createDocumentsTable(connector, databaseName, embeddingDimensions);
  await createSourceDocumentsTable(connector, databaseName);
  await createMetadataTable(connector, databaseName);
}
