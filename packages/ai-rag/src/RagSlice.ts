import {DuckDbSliceState} from '@sqlrooms/duckdb';
import {
  BaseRoomStoreState,
  createSlice,
  StateCreator,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {
  chunkMarkdown,
  chunkBySize,
  validateAndSplitChunks,
  initializeRagSchema,
  insertDocument,
  insertSourceDocument,
  updateMetadataStats,
  type ChunkResult,
} from './prepare';
import {extractTextFromPDF, isPdfFile} from './prepare/pdf';

export type EmbeddingResult = {
  score: number;
  text: string;
  nodeId: string;
  metadata?: Record<string, unknown>;
};

/**
 * Function that generates an embedding vector from text.
 * This can be implemented using:
 * - OpenAI API (e.g., text-embedding-3-small)
 * - Transformers.js (client-side, e.g., BAAI/bge-small-en-v1.5)
 * - Custom embedding service
 * - Cohere, Anthropic, etc.
 *
 * IMPORTANT: The embedding provider MUST match the model used during database preparation.
 * Check the database metadata to ensure compatibility.
 *
 * API key management (if needed) should be handled during provider creation,
 * not at call time. See `createAiEmbeddingProvider` for examples.
 */
export type EmbeddingProvider = (text: string) => Promise<number[]>;

export type EmbeddingDatabase = {
  /** Path or URL to the DuckDB embedding database file. Optional for in-memory databases. */
  databaseFilePathOrUrl?: string;
  /** Name to use when attaching the database */
  databaseName: string;
  /**
   * Embedding provider for this database.
   * MUST match the model used during database preparation.
   * Example: If database was prepared with OpenAI text-embedding-3-small,
   * provide an OpenAI embedding function here.
   *
   * Note: API key management (if needed) should be configured during provider
   * creation using `createAiEmbeddingProvider` with a `getApiKey` function.
   */
  embeddingProvider: EmbeddingProvider;
  /**
   * Expected embedding dimensions (for validation).
   * Should match the model used during preparation.
   * Will be validated against database metadata.
   */
  embeddingDimensions?: number;
};

export type DatabaseMetadata = {
  provider: string;
  model: string;
  dimensions: number;
  chunkingStrategy: string;
};

export type QueryOptions = {
  /** Number of results to return (default: 5) */
  topK?: number;
  /** Database to search (defaults to first database) */
  database?: string;
};

/**
 * Input for adding a document to the RAG database.
 */
export type DocumentInput = {
  /** Text content of the document */
  text: string;
  /** Optional metadata to store with the document */
  metadata?: Record<string, unknown>;
  /** Optional file name */
  fileName?: string;
  /** Optional file path */
  filePath?: string;
};

/**
 * Options for preparing/adding documents.
 */
export type PrepareOptions = {
  /** Database to add to (defaults to first database) */
  database?: string;
  /** Chunk size in tokens (default: 512) */
  chunkSize?: number;
  /** Use markdown-aware chunking (default: true) */
  useMarkdownChunking?: boolean;
  /** Include headers in chunks for weighting (default: true) */
  includeHeaders?: boolean;
  /** Header repetition weight (default: 3) */
  headerWeight?: number;
  /** Store source document (default: true) */
  storeSourceDocument?: boolean;
};

/**
 * Source document from the database.
 */
export type SourceDocument = {
  docId: string;
  filePath: string;
  fileName: string;
  text: string;
  metadata: Record<string, unknown>;
};

export type RagSliceState = {
  rag: {
    /**
     * Initialize RAG by attaching all embedding databases and validating metadata
     */
    initialize: () => Promise<void>;

    /**
     * Query embeddings using a pre-computed embedding vector
     * @param queryEmbedding - The embedding vector for the query (e.g., 384-dimensional array)
     * @param options - Query options (topK, database to search, hybrid search)
     * @returns Array of results sorted by similarity score
     */
    queryEmbeddings: (
      queryEmbedding: number[],
      options?: QueryOptions,
    ) => Promise<EmbeddingResult[]>;

    /**
     * Query embeddings using text.
     * Uses the embedding provider configured for the specified database.
     * By default, performs hybrid search combining vector similarity with full-text search.
     * @param queryText - The text query
     * @param options - Query options (topK, database to search, hybrid search)
     * @returns Array of results sorted by similarity score
     * @throws Error if database not found or no embedding provider configured
     */
    queryByText: (
      queryText: string,
      options?: QueryOptions,
    ) => Promise<EmbeddingResult[]>;

    /**
     * Get metadata for a specific database
     * @param databaseName - Name of the database
     * @returns Database metadata (model, dimensions, etc.)
     */
    getMetadata: (databaseName: string) => Promise<DatabaseMetadata | null>;

    /**
     * List all attached embedding databases
     */
    listDatabases: () => string[];

    /**
     * Initialize an empty RAG database with schema.
     * Call this before adding documents to a new database.
     * @param databaseName - Name of the database
     * @param embeddingDimensions - Embedding dimensions for the database
     */
    initializeEmptyDatabase: (
      databaseName: string,
      embeddingDimensions: number,
    ) => Promise<void>;

    /**
     * Add a single document to the RAG database.
     * Document will be chunked, embedded, and stored.
     * @param document - Document to add
     * @param options - Preparation options
     * @returns Array of node IDs for the created chunks
     */
    addDocument: (
      document: DocumentInput,
      options?: PrepareOptions,
    ) => Promise<string[]>;

    /**
     * Add multiple documents in batch.
     * @param documents - Documents to add
     * @param options - Preparation options
     * @returns Array of node IDs for all created chunks
     */
    addDocuments: (
      documents: DocumentInput[],
      options?: PrepareOptions,
    ) => Promise<string[]>;

    /**
     * Add a PDF file to the RAG database.
     * PDF will be parsed, chunked, embedded, and stored.
     * @param file - PDF file to add
     * @param options - Preparation options
     * @returns Array of node IDs for the created chunks
     */
    addPdfDocument: (file: File, options?: PrepareOptions) => Promise<string[]>;

    /**
     * Get source documents by chunk IDs.
     * @param chunkIds - Array of node IDs
     * @param database - Database to query (defaults to first)
     * @returns Array of source documents
     */
    getSourceDocuments: (
      chunkIds: string[],
      database?: string,
    ) => Promise<SourceDocument[]>;
  };
};

export function createRagSlice({
  embeddingsDatabases,
}: {
  embeddingsDatabases: EmbeddingDatabase[];
}): StateCreator<RagSliceState> {
  return createSlice<
    RagSliceState,
    BaseRoomStoreState & DuckDbSliceState & RagSliceState
  >((set, get) => {
    let initialized = false;
    // Map of database name -> embedding provider
    const databaseProviders = new Map<string, EmbeddingProvider>();
    // Map of database name -> metadata
    const databaseMetadata = new Map<string, DatabaseMetadata>();

    return {
      rag: {
        initialize: async () => {
          if (initialized) {
            return;
          }

          const connector = get().db.connector;

          // Attach each embedding database and store its provider
          for (const {
            databaseFilePathOrUrl,
            databaseName,
            embeddingProvider,
            embeddingDimensions,
          } of embeddingsDatabases) {
            try {
              // Store the embedding provider for this database
              databaseProviders.set(databaseName, embeddingProvider);

              // If no file path, create an in-memory database with schema
              if (!databaseFilePathOrUrl) {
                // Create in-memory attached database
                await connector.query(
                  `ATTACH DATABASE ':memory:' AS ${databaseName}`,
                );
                // Initialize schema
                if (embeddingDimensions) {
                  await initializeRagSchema(
                    connector,
                    databaseName,
                    embeddingDimensions,
                  );
                }
                console.log(
                  `✓ Created in-memory RAG database: ${databaseName}`,
                );
                continue;
              }

              // ATTACH DATABASE 'path/to/file.duckdb' AS database_name (READ_ONLY)
              await connector.query(
                `ATTACH DATABASE '${databaseFilePathOrUrl}' AS ${databaseName} (READ_ONLY)`,
              );

              // Fetch and validate metadata from the database
              try {
                const metadataQuery = `
                  SELECT key, value 
                  FROM ${databaseName}.embedding_metadata 
                  WHERE key IN ('embedding_provider', 'embedding_model', 'embedding_dimensions', 'chunking_strategy')
                `;
                const metadataResult = await connector.query(metadataQuery);
                const metadataRows = metadataResult.toArray();

                const metadata: Partial<DatabaseMetadata> = {};
                for (const row of metadataRows) {
                  const typedRow = row as {key: string; value: string};
                  if (typedRow.key === 'embedding_provider')
                    metadata.provider = typedRow.value;
                  if (typedRow.key === 'embedding_model')
                    metadata.model = typedRow.value;
                  if (typedRow.key === 'embedding_dimensions')
                    metadata.dimensions = parseInt(typedRow.value, 10);
                  if (typedRow.key === 'chunking_strategy')
                    metadata.chunkingStrategy = typedRow.value;
                }

                // Validate dimensions if provided
                if (
                  embeddingDimensions &&
                  metadata.dimensions &&
                  embeddingDimensions !== metadata.dimensions
                ) {
                  console.warn(
                    `⚠️  Dimension mismatch for ${databaseName}: expected ${embeddingDimensions}, got ${metadata.dimensions}`,
                  );
                }

                if (
                  metadata.provider &&
                  metadata.model &&
                  metadata.dimensions &&
                  metadata.chunkingStrategy
                ) {
                  databaseMetadata.set(
                    databaseName,
                    metadata as DatabaseMetadata,
                  );
                  console.log(
                    `✓ Attached ${databaseName} (${metadata.provider}/${metadata.model}, ${metadata.dimensions}d)`,
                  );
                }
              } catch (metadataError) {
                console.warn(
                  `Could not read metadata for ${databaseName}:`,
                  metadataError,
                );
                console.log(`✓ Attached embedding database: ${databaseName}`);
              }
            } catch (error) {
              console.error(
                `Failed to attach database ${databaseName}:`,
                error,
              );
              throw error;
            }
          }

          initialized = true;
        },

        queryEmbeddings: async (
          queryEmbedding: number[],
          options: QueryOptions = {},
        ): Promise<EmbeddingResult[]> => {
          const {topK = 5, database} = options;
          const connector = get().db.connector;

          if (!initialized) {
            await get().rag.initialize();
          }

          const dbName = database || Array.from(databaseProviders.keys())[0];
          if (!dbName || !databaseProviders.has(dbName)) {
            throw new Error(
              `Database "${dbName}" not found. Available: ${Array.from(databaseProviders.keys()).join(', ')}`,
            );
          }

          const embeddingDim = queryEmbedding.length;
          const embeddingLiteral = `[${queryEmbedding.join(', ')}]`;

          const metadata = databaseMetadata.get(dbName);
          if (metadata && metadata.dimensions !== embeddingDim) {
            throw new Error(
              `Dimension mismatch: query has ${embeddingDim}d, database expects ${metadata.dimensions}d`,
            );
          }

          const query = `
            SELECT node_id, text, metadata_,
              array_cosine_similarity(embedding, ${embeddingLiteral}::FLOAT[${embeddingDim}]) as similarity
            FROM ${dbName}.documents
            ORDER BY similarity DESC
            LIMIT ${topK}
          `;

          const result = await connector.query(query);
          return result.toArray().map((row: any) => ({
            nodeId: row.node_id as string,
            text: row.text as string,
            score: row.similarity as number,
            metadata: row.metadata_
              ? JSON.parse(row.metadata_ as string)
              : undefined,
          }));
        },

        queryByText: async (
          queryText: string,
          options: QueryOptions = {},
        ): Promise<EmbeddingResult[]> => {
          const {database, topK = 5} = options;

          if (!initialized) {
            await get().rag.initialize();
          }

          const dbName = database || Array.from(databaseProviders.keys())[0];
          if (!dbName || !databaseProviders.has(dbName)) {
            throw new Error(
              `Database "${dbName}" not found. Available: ${Array.from(databaseProviders.keys()).join(', ')}`,
            );
          }

          const embeddingProvider = databaseProviders.get(dbName)!;
          const embedding = await embeddingProvider(queryText);

          return get().rag.queryEmbeddings(embedding, {database: dbName, topK});
        },

        getMetadata: async (databaseName: string) => {
          // Ensure RAG is initialized
          if (!initialized) {
            await get().rag.initialize();
          }

          return databaseMetadata.get(databaseName) || null;
        },

        listDatabases: () => {
          return Array.from(databaseProviders.keys());
        },

        initializeEmptyDatabase: async (
          databaseName: string,
          embeddingDimensions: number,
        ) => {
          const connector = get().db.connector;

          // Check if this database is configured
          const dbConfig = embeddingsDatabases.find(
            (db) => db.databaseName === databaseName,
          );

          // Initialize the schema (database should already be attached from initialize())
          await initializeRagSchema(
            connector,
            databaseName,
            embeddingDimensions,
          );

          // Store the provider if configured
          if (dbConfig && !databaseProviders.has(databaseName)) {
            databaseProviders.set(databaseName, dbConfig.embeddingProvider);
          }

          console.log(`✓ Initialized empty RAG database: ${databaseName}`);
        },

        addDocument: async (
          document: DocumentInput,
          options: PrepareOptions = {},
        ): Promise<string[]> => {
          const {
            database,
            chunkSize = 512,
            useMarkdownChunking = true,
            includeHeaders = true,
            headerWeight = 3,
            storeSourceDocument = true,
          } = options;

          if (!initialized) {
            await get().rag.initialize();
          }

          const dbName = database || Array.from(databaseProviders.keys())[0];
          if (!dbName || !databaseProviders.has(dbName)) {
            throw new Error(
              `Database "${dbName}" not found. Available: ${Array.from(databaseProviders.keys()).join(', ')}`,
            );
          }

          const connector = get().db.connector;
          const embeddingProvider = databaseProviders.get(dbName)!;
          const docId = `doc_${crypto.randomUUID()}`;

          if (storeSourceDocument) {
            await insertSourceDocument(connector, dbName, {
              docId,
              text: document.text,
              filePath: document.filePath,
              fileName: document.fileName,
              metadata: document.metadata,
            });
          }

          // Chunk document (~3 chars per token)
          const chunkChars = chunkSize * 3;
          let chunks: ChunkResult[] = useMarkdownChunking
            ? chunkMarkdown(document.text, {
                chunkSize: chunkChars,
                includeHeaders,
                headerWeight,
              })
            : chunkBySize(document.text, chunkChars);

          // Split chunks exceeding token limits
          chunks = validateAndSplitChunks(chunks, 5000);

          const nodeIds: string[] = [];
          for (const chunk of chunks) {
            const nodeId = `node_${crypto.randomUUID()}`;
            nodeIds.push(nodeId);

            const embedding = await embeddingProvider(chunk.text);
            await insertDocument(connector, dbName, {
              nodeId,
              text: chunk.text,
              embedding,
              metadata: {
                ...document.metadata,
                ...chunk.metadata,
                file_path: document.filePath,
                file_name: document.fileName,
              },
              docId,
            });
          }

          try {
            await updateMetadataStats(connector, dbName, chunks, [
              {text: document.text},
            ]);
          } catch {
            // Metadata table may not exist
          }

          console.log(
            `✓ Added document with ${nodeIds.length} chunks to ${dbName}`,
          );
          return nodeIds;
        },

        addDocuments: async (
          documents: DocumentInput[],
          options: PrepareOptions = {},
        ): Promise<string[]> => {
          const allNodeIds: string[] = [];
          for (const doc of documents) {
            const nodeIds = await get().rag.addDocument(doc, options);
            allNodeIds.push(...nodeIds);
          }
          return allNodeIds;
        },

        addPdfDocument: async (
          file: File,
          options: PrepareOptions = {},
        ): Promise<string[]> => {
          if (!isPdfFile(file)) {
            throw new Error('File is not a PDF');
          }

          // Extract text from PDF
          const text = await extractTextFromPDF(file);

          // Add as document
          return get().rag.addDocument(
            {
              text,
              fileName: file.name,
              metadata: {
                source: 'pdf',
                originalFileName: file.name,
                fileSize: file.size,
              },
            },
            options,
          );
        },

        getSourceDocuments: async (
          chunkIds: string[],
          database?: string,
        ): Promise<SourceDocument[]> => {
          if (chunkIds.length === 0) return [];

          const connector = get().db.connector;
          const dbName = database || Array.from(databaseProviders.keys())[0];

          const placeholders = chunkIds
            .map((id) => `'${id.replace(/'/g, "''")}'`)
            .join(', ');

          // Get doc IDs from chunks
          const docIdsResult = await connector.query(`
            SELECT DISTINCT doc_id 
            FROM ${dbName}.documents 
            WHERE node_id IN (${placeholders}) AND doc_id IS NOT NULL
          `);
          const docIds = docIdsResult
            .toArray()
            .map((r: any) => r.doc_id as string);

          if (docIds.length === 0) return [];

          const docPlaceholders = docIds
            .map((id: string) => `'${id.replace(/'/g, "''")}'`)
            .join(', ');
          const result = await connector.query(`
            SELECT doc_id, file_path, file_name, text, metadata_
            FROM ${dbName}.source_documents
            WHERE doc_id IN (${docPlaceholders})
          `);

          return result.toArray().map((row: any) => ({
            docId: row.doc_id as string,
            filePath: row.file_path as string,
            fileName: row.file_name as string,
            text: row.text as string,
            metadata: row.metadata_ ? JSON.parse(row.metadata_ as string) : {},
          }));
        },
      },
    };
  });
}

type RoomStateWithRag = BaseRoomStoreState & DuckDbSliceState & RagSliceState;

export function useStoreWithRag<T>(
  selector: (state: RoomStateWithRag) => T,
): T {
  return useBaseRoomStore<DuckDbSliceState, T>((state) =>
    selector(state as unknown as RoomStateWithRag),
  );
}
