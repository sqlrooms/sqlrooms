/**
 * Metadata creation and storage for embedding databases.
 * Mirrors: python/rag/sqlrooms_rag/prepare/metadata.py
 */

import type {DuckDbConnector} from '@sqlrooms/duckdb';

export type ChunkStats = {
  totalChunks: number;
  minChunkSize: number;
  maxChunkSize: number;
  medianChunkSize: number;
  meanChunkSize: number;
  totalCharacters: number;
};

export type EmbeddingMetadata = {
  version: string;
  createdAt: string;
  embedding: {
    provider: string;
    model: string;
    dimensions: number;
  };
  chunking: {
    strategy: 'markdown-aware' | 'size-based';
    chunkSize: number;
    includeHeaders: boolean;
    headerWeight: number;
  };
  sourceDocuments: {
    totalDocuments: number;
    uniqueFiles: number;
    totalCharacters: number;
  };
  chunks: ChunkStats;
  capabilities: {
    hybridSearch: boolean;
    ftsEnabled: boolean;
    sourceDocumentsStored: boolean;
  };
};

/**
 * Calculate statistics about chunks.
 */
export function calculateChunkStats(chunks: Array<{text: string}>): ChunkStats {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      minChunkSize: 0,
      maxChunkSize: 0,
      medianChunkSize: 0,
      meanChunkSize: 0,
      totalCharacters: 0,
    };
  }

  const sizes = chunks.map((c) => c.text.length).sort((a, b) => a - b);
  const total = sizes.reduce((a, b) => a + b, 0);

  return {
    totalChunks: sizes.length,
    minChunkSize: sizes[0] ?? 0,
    maxChunkSize: sizes[sizes.length - 1] ?? 0,
    medianChunkSize: sizes[Math.floor(sizes.length / 2)] ?? 0,
    meanChunkSize: Math.floor(total / sizes.length),
    totalCharacters: total,
  };
}

/**
 * Options for creating metadata.
 */
export type CreateMetadataOptions = {
  provider: string;
  model: string;
  dimensions: number;
  chunkSize: number;
  useMarkdownChunking: boolean;
  includeHeaders: boolean;
  headerWeight: number;
  documents: Array<{text: string; metadata?: Record<string, unknown>}>;
  chunks: Array<{text: string}>;
};

/**
 * Create metadata object for the embedding database.
 */
export function createMetadata(
  options: CreateMetadataOptions,
): EmbeddingMetadata {
  const chunkStats = calculateChunkStats(options.chunks);

  const uniqueFiles = new Set<string>();
  for (const doc of options.documents) {
    const filePath = doc.metadata?.file_path || doc.metadata?.fileName;
    if (filePath) uniqueFiles.add(String(filePath));
  }

  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    embedding: {
      provider: options.provider,
      model: options.model,
      dimensions: options.dimensions,
    },
    chunking: {
      strategy: options.useMarkdownChunking ? 'markdown-aware' : 'size-based',
      chunkSize: options.chunkSize,
      includeHeaders: options.includeHeaders,
      headerWeight: options.includeHeaders ? options.headerWeight : 0,
    },
    sourceDocuments: {
      totalDocuments: options.documents.length,
      uniqueFiles: uniqueFiles.size,
      totalCharacters: options.documents.reduce(
        (sum, d) => sum + d.text.length,
        0,
      ),
    },
    chunks: chunkStats,
    capabilities: {
      hybridSearch: true,
      ftsEnabled: true,
      sourceDocumentsStored: true,
    },
  };
}

/**
 * Store metadata in the database.
 */
export async function storeMetadataInDb(
  connector: DuckDbConnector,
  databaseName: string,
  metadata: EmbeddingMetadata,
): Promise<void> {
  const flatMetadata: Record<string, string> = {
    version: metadata.version,
    created_at: metadata.createdAt,
    embedding_provider: metadata.embedding.provider,
    embedding_model: metadata.embedding.model,
    embedding_dimensions: String(metadata.embedding.dimensions),
    chunking_strategy: metadata.chunking.strategy,
    chunk_size: String(metadata.chunking.chunkSize),
    include_headers: String(metadata.chunking.includeHeaders),
    header_weight: String(metadata.chunking.headerWeight),
    total_source_documents: String(metadata.sourceDocuments.totalDocuments),
    unique_files: String(metadata.sourceDocuments.uniqueFiles),
    source_total_characters: String(metadata.sourceDocuments.totalCharacters),
    total_chunks: String(metadata.chunks.totalChunks),
    min_chunk_size: String(metadata.chunks.minChunkSize),
    max_chunk_size: String(metadata.chunks.maxChunkSize),
    median_chunk_size: String(metadata.chunks.medianChunkSize),
    mean_chunk_size: String(metadata.chunks.meanChunkSize),
    chunks_total_characters: String(metadata.chunks.totalCharacters),
    hybrid_search_enabled: String(metadata.capabilities.hybridSearch),
    fts_enabled: String(metadata.capabilities.ftsEnabled),
    source_documents_stored: String(
      metadata.capabilities.sourceDocumentsStored,
    ),
  };

  for (const [key, value] of Object.entries(flatMetadata)) {
    await connector.query(`
      INSERT INTO ${databaseName}.embedding_metadata (key, value)
      VALUES ('${key}', '${value.replace(/'/g, "''")}')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `);
  }
}

/**
 * Update metadata when documents are added.
 */
export async function updateMetadataStats(
  connector: DuckDbConnector,
  databaseName: string,
  newChunks: Array<{text: string}>,
  newDocuments: Array<{text: string}>,
): Promise<void> {
  // Get current stats
  const currentStats = await connector.query(`
    SELECT key, value FROM ${databaseName}.embedding_metadata
    WHERE key IN ('total_chunks', 'total_source_documents', 'chunks_total_characters', 'source_total_characters')
  `);

  const statsMap = new Map<string, number>();
  for (const row of currentStats.toArray()) {
    statsMap.set(row.key as string, parseInt(row.value as string, 10) || 0);
  }

  const newChunkStats = calculateChunkStats(newChunks);
  const newDocChars = newDocuments.reduce((sum, d) => sum + d.text.length, 0);

  const updates: Record<string, string> = {
    total_chunks: String(
      (statsMap.get('total_chunks') || 0) + newChunkStats.totalChunks,
    ),
    total_source_documents: String(
      (statsMap.get('total_source_documents') || 0) + newDocuments.length,
    ),
    chunks_total_characters: String(
      (statsMap.get('chunks_total_characters') || 0) +
        newChunkStats.totalCharacters,
    ),
    source_total_characters: String(
      (statsMap.get('source_total_characters') || 0) + newDocChars,
    ),
  };

  for (const [key, value] of Object.entries(updates)) {
    await connector.query(`
      INSERT INTO ${databaseName}.embedding_metadata (key, value)
      VALUES ('${key}', '${value}')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `);
  }
}
