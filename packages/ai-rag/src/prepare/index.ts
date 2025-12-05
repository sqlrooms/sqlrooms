/**
 * Prepare module for browser-side RAG document preparation.
 * Mirrors: python/rag/sqlrooms_rag/prepare/
 */

// Chunking utilities
export {
  countTokens,
  chunkMarkdown,
  chunkBySize,
  validateAndSplitChunks,
  type ChunkResult,
  type ChunkMarkdownOptions,
} from './chunking';

// Database utilities
export {
  createDocumentsTable,
  createSourceDocumentsTable,
  createMetadataTable,
  createFtsIndex,
  insertDocument,
  insertSourceDocument,
  initializeRagSchema,
  type InsertDocumentParams,
  type InsertSourceDocumentParams,
} from './database';

// Metadata utilities
export {
  calculateChunkStats,
  createMetadata,
  storeMetadataInDb,
  updateMetadataStats,
  type ChunkStats,
  type EmbeddingMetadata,
  type CreateMetadataOptions,
} from './metadata';

// PDF utilities
export {extractTextFromPDF, extractTextFromPDFBuffer, isPdfFile} from './pdf';
