import {DuckDbSliceState} from '@sqlrooms/duckdb';
import {
  BaseRoomStoreState,
  createSlice,
  StateCreator,
  useBaseRoomStore,
} from '@sqlrooms/room-shell';

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
  /** Path or URL to the DuckDB embedding database file */
  databaseFilePathOrUrl: string;
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

export type RagSliceState = {
  rag: {
    /**
     * Initialize RAG by attaching all embedding databases and validating metadata
     */
    initialize: () => Promise<void>;

    /**
     * Query embeddings using a pre-computed embedding vector
     * @param queryEmbedding - The embedding vector for the query (e.g., 384-dimensional array)
     * @param options - Query options (topK, database to search)
     * @returns Array of results sorted by similarity score
     */
    queryEmbeddings: (
      queryEmbedding: number[],
      options?: {
        topK?: number;
        database?: string;
      },
    ) => Promise<EmbeddingResult[]>;

    /**
     * Query embeddings using text.
     * Uses the embedding provider configured for the specified database.
     * @param queryText - The text query
     * @param options - Query options (topK, database to search)
     * @returns Array of results sorted by similarity score
     * @throws Error if database not found or no embedding provider configured
     */
    queryByText: (
      queryText: string,
      options?: {
        topK?: number;
        database?: string;
      },
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
              // ATTACH DATABASE 'path/to/file.duckdb' AS database_name (READ_ONLY)
              await connector.query(
                `ATTACH DATABASE '${databaseFilePathOrUrl}' AS ${databaseName} (READ_ONLY)`,
              );

              // Store the embedding provider for this database
              databaseProviders.set(databaseName, embeddingProvider);

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
          options = {},
        ): Promise<EmbeddingResult[]> => {
          const {topK = 5, database} = options;
          const connector = get().db.connector;

          // Ensure RAG is initialized
          if (!initialized) {
            await get().rag.initialize();
          }

          // Determine which database to search (default to first one)
          const dbName = database || Array.from(databaseProviders.keys())[0];

          if (!dbName || !databaseProviders.has(dbName)) {
            throw new Error(
              `Database "${dbName}" not found. Available: ${Array.from(databaseProviders.keys()).join(', ')}`,
            );
          }

          const embeddingDim = queryEmbedding.length;
          const embeddingLiteral = `[${queryEmbedding.join(', ')}]`;

          // Validate dimensions
          const metadata = databaseMetadata.get(dbName);
          if (metadata && metadata.dimensions !== embeddingDim) {
            throw new Error(
              `Dimension mismatch: query has ${embeddingDim} dimensions, ` +
                `but database "${dbName}" expects ${metadata.dimensions} dimensions`,
            );
          }

          const query = `
            SELECT 
              node_id,
              text,
              metadata_,
              array_cosine_similarity(embedding, ${embeddingLiteral}::FLOAT[${embeddingDim}]) as similarity
            FROM ${dbName}.documents
            ORDER BY similarity DESC
            LIMIT ${topK}
          `;

          try {
            const result = await connector.query(query);
            const rows = result.toArray();

            return rows.map((row: any) => ({
              nodeId: row.node_id as string,
              text: row.text as string,
              score: row.similarity as number,
              metadata: row.metadata_
                ? (JSON.parse(row.metadata_ as string) as Record<
                    string,
                    unknown
                  >)
                : undefined,
            }));
          } catch (error) {
            console.error('Error querying embeddings:', error);
            throw error;
          }
        },

        queryByText: async (
          queryText: string,
          options = {},
        ): Promise<EmbeddingResult[]> => {
          const {database} = options;

          // Determine which database to search (default to first one)
          const dbName = database || Array.from(databaseProviders.keys())[0];

          if (!dbName || !databaseProviders.has(dbName)) {
            throw new Error(
              `Database "${dbName}" not found. Available: ${Array.from(databaseProviders.keys()).join(', ')}`,
            );
          }

          const embeddingProvider = databaseProviders.get(dbName)!;

          // Generate embedding from text using the database's provider
          const embedding = await embeddingProvider(queryText);

          // Query using the embedding
          return get().rag.queryEmbeddings(embedding, {
            ...options,
            database: dbName,
          });
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
