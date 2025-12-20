/**
 * {@include ../README.md}
 * @packageDocumentation
 */
export {
  createRagSlice,
  useStoreWithRag,
  type RagSliceState,
  type EmbeddingResult,
  type EmbeddingDatabase,
  type EmbeddingProvider,
  type DatabaseMetadata,
  type QueryOptions,
  type DocumentInput,
  type PrepareOptions,
  type SourceDocument,
} from './RagSlice';
export {
  createRagTool,
  RagToolParameters,
  type RagToolLlmResult,
  type RagToolAdditionalData,
  type RagToolContext,
} from './createRagTool';
export {
  createAiEmbeddingProvider,
  type AiProvider,
  type AiProviderFactory,
} from './createAiEmbeddingProvider';

// Prepare module exports
export {
  // Chunking utilities
  countTokens,
  chunkMarkdown,
  chunkBySize,
  validateAndSplitChunks,
  type ChunkResult,
  type ChunkMarkdownOptions,
  // Database utilities
  createDocumentsTable,
  createSourceDocumentsTable,
  createMetadataTable,
  createFtsIndex,
  insertDocument,
  insertSourceDocument,
  initializeRagSchema,
  type InsertDocumentParams,
  type InsertSourceDocumentParams,
  // Metadata utilities
  calculateChunkStats,
  createMetadata,
  storeMetadataInDb,
  updateMetadataStats,
  type ChunkStats,
  type EmbeddingMetadata,
  type CreateMetadataOptions,
  // PDF utilities
  extractTextFromPDF,
  extractTextFromPDFBuffer,
  isPdfFile,
} from './prepare';
