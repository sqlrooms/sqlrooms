import {DuckDbSliceConfig} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createSlice,
  RoomShellSliceState,
  StateCreator,
  useBaseRoomShellStore,
} from '@sqlrooms/room-shell';

export type EmbeddingResult = {
  score: number;
  text: string;
  nodeId: string;
  metadata?: Record<string, unknown>;
};

export type EmbeddingDatabase = {
  databaseFilePath: string;
  databaseName: string;
};

export type RagSliceState = {
  rag: {
    /**
     * Initialize RAG by attaching all embedding databases
     */
    initialize: () => Promise<void>;

    /**
     * Query embeddings using a pre-computed embedding vector
     * @param queryEmbedding - The embedding vector for the query (e.g., 384-dimensional array)
     * @param options - Query options (topK, databases to search)
     * @returns Array of results sorted by similarity score
     */
    queryEmbeddings: (
      queryEmbedding: number[],
      options?: {
        topK?: number;
        databases?: string[];
      },
    ) => Promise<EmbeddingResult[]>;

    /**
     * List all attached embedding databases
     */
    listDatabases: () => string[];
  };
};

export function createRagSlice<PC extends BaseRoomConfig & DuckDbSliceConfig>({
  embeddingsDatabases,
}: {
  embeddingsDatabases: EmbeddingDatabase[];
}): StateCreator<RagSliceState> {
  return createSlice<PC, RagSliceState>((set, get) => {
    let initialized = false;
    const attachedDatabases = new Set<string>();

    return {
      rag: {
        initialize: async () => {
          if (initialized) {
            return;
          }

          const connector = get().db.connector;

          // Attach each embedding database
          for (const {databaseFilePath, databaseName} of embeddingsDatabases) {
            try {
              // ATTACH DATABASE 'path/to/file.duckdb' AS database_name (READ_ONLY)
              await connector.query(
                `ATTACH DATABASE '${databaseFilePath}' AS ${databaseName} (READ_ONLY)`,
              );
              attachedDatabases.add(databaseName);
              console.log(`✓ Attached embedding database: ${databaseName}`);
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
          const {topK = 5, databases} = options;
          const connector = get().db.connector;

          // Ensure RAG is initialized
          if (!initialized) {
            await get().rag.initialize();
          }

          // Determine which databases to search
          const databasesToSearch = databases || Array.from(attachedDatabases);

          if (databasesToSearch.length === 0) {
            throw new Error('No embedding databases available to search');
          }

          const embeddingDim = queryEmbedding.length;
          const embeddingLiteral = `[${queryEmbedding.join(', ')}]`;

          // Build UNION query across all databases
          const unionQueries = databasesToSearch.map(
            (dbName) => `
              SELECT 
                node_id,
                text,
                metadata_,
                array_cosine_similarity(embedding, ${embeddingLiteral}::FLOAT[${embeddingDim}]) as similarity
              FROM ${dbName}.documents
            `,
          );

          const query = `
            WITH all_results AS (
              ${unionQueries.join(' UNION ALL ')}
            )
            SELECT 
              node_id,
              text,
              metadata_,
              similarity
            FROM all_results
            ORDER BY similarity DESC
            LIMIT ${topK}
          `;

          try {
            const result = await connector.query(query);
            const rows = result.toArray();

            return rows.map((row) => ({
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

        listDatabases: () => {
          return Array.from(attachedDatabases);
        },
      },
    };
  });
}

export function useStoreWithRag<T>(
  selector: (state: RoomShellSliceState<BaseRoomConfig>) => T,
): T {
  return useBaseRoomShellStore<
    BaseRoomConfig,
    RoomShellSliceState<BaseRoomConfig>,
    T
  >((state) =>
    selector(state as unknown as RoomShellSliceState<BaseRoomConfig>),
  );
}
