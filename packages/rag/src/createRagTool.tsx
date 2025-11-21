import {useState} from 'react';
import {z} from 'zod';
import {OpenAssistantTool} from '@openassistant/utils';
import type {RagSliceState} from './RagSlice';

/**
 * Zod schema for the RAG tool parameters
 */
export const RagToolParameters = z.object({
  query: z
    .string()
    .describe(
      'The search query. Be specific and descriptive. Example: "How to create a table in DuckDB" or "React hooks usage"',
    ),
  database: z
    .string()
    .optional()
    .describe(
      'Which documentation database to search (e.g., "duckdb_docs", "react_docs"). If not specified, searches the default database.',
    ),
  topK: z
    .number()
    .optional()
    .default(5)
    .describe('Number of results to return (default: 5, max: 20)'),
});

export type RagToolParameters = z.infer<typeof RagToolParameters>;

export type RagToolLlmResult = {
  success: boolean;
  error?: string;
  query?: string;
  database?: string;
  results?: Array<{
    text: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>;
  context?: string;
  details?: string;
};

export type RagToolAdditionalData = Record<string, never>;

export type RagToolContext = unknown;

/**
 * Individual result item with collapsible details
 */
function RagResultItem({
  result,
  index,
}: {
  result: {text: string; score: number; metadata?: Record<string, unknown>};
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {isExpanded ? '▼' : '▶'} Result #{index + 1}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Score: {result.score.toFixed(3)}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          <p className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-300">
            {result.text}
          </p>
          {result.metadata &&
            typeof result.metadata.file_path === 'string' &&
            result.metadata.file_path && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                📄 {result.metadata.file_path}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

/**
 * Result component for displaying RAG search results
 */
function RagToolResult(result: RagToolLlmResult) {
  if (!result?.success) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-3 text-red-600 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
        <p className="text-xs font-semibold">RAG Search Failed</p>
        <p className="text-xs">{result?.error || 'Unknown error'}</p>
      </div>
    );
  }

  const {query, results, database} = result;

  return (
    <div className="space-y-2 rounded border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
      <div>
        <p className="text-xs font-semibold text-blue-900 dark:text-blue-300">
          RAG Search: "{query}"
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-400">
          Database: {database} | Found {results?.length || 0} results
        </p>
      </div>

      <div className="space-y-2">
        {results &&
          results.map((result, i) => (
            <RagResultItem key={i} result={result} index={i} />
          ))}
      </div>
    </div>
  );
}

/**
 * Create a RAG (Retrieval Augmented Generation) tool for AI.
 *
 * This tool allows the AI to search through embedded documentation
 * to find relevant context before answering questions.
 *
 * @example
 * ```typescript
 * const store = createRoomStore({
 *   slices: [
 *     createRagSlice({embeddingsDatabases: [...]}),
 *     createAiSlice({
 *       tools: {
 *         rag: createRagTool(),
 *       }
 *     })
 *   ]
 * });
 * ```
 */
export function createRagTool(): OpenAssistantTool<
  typeof RagToolParameters,
  RagToolLlmResult,
  RagToolAdditionalData,
  RagToolContext
> {
  return {
    name: 'search_documentation',
    description: `Search through documentation and knowledge bases using semantic search.
    
Use this tool when you need to:
- Find specific information in documentation
- Look up API references or technical details
- Get context about features, functions, or concepts
- Answer questions that require domain knowledge

The search uses vector embeddings to find semantically similar content, not just keyword matching.`,

    parameters: RagToolParameters,

    execute: async (params: RagToolParameters) => {
      const {query, database, topK = 5} = params;
      // Get the store instance
      const store = (globalThis as any).__ROOM_STORE__;
      if (!store) {
        return {
          llmResult: {
            success: false,
            error: 'Store not available',
          } satisfies RagToolLlmResult,
        };
      }

      const state = store.getState() as RagSliceState;

      try {
        // Initialize RAG if not already initialized
        await state.rag.initialize();

        // Clamp topK to reasonable limits
        const clampedTopK = Math.min(Math.max(1, topK), 20);

        // Determine which database to search
        const targetDatabase = database || state.rag.listDatabases()[0];

        if (!targetDatabase) {
          return {
            llmResult: {
              success: false,
              error: 'No RAG databases configured',
            } satisfies RagToolLlmResult,
          };
        }

        // Perform the search
        const results = await state.rag.queryByText(query, {
          topK: clampedTopK,
          database: targetDatabase,
        });

        // Format results for LLM
        const formattedContext = results
          .map(
            (result, i) =>
              `[Result ${i + 1}] (Score: ${result.score.toFixed(3)})\n${result.text}`,
          )
          .join('\n\n---\n\n');

        return {
          llmResult: {
            success: true,
            query,
            database: targetDatabase,
            results: results.map((r) => ({
              text: r.text,
              score: r.score,
              metadata: r.metadata,
            })),
            // Provide formatted context for the LLM
            context: formattedContext,
            details: `Found ${results.length} relevant documents in ${targetDatabase}`,
          } satisfies RagToolLlmResult,
        };
      } catch (error) {
        console.error('RAG search error:', error);
        return {
          llmResult: {
            success: false,
            error:
              error instanceof Error ? error.message : 'Unknown error occurred',
          } satisfies RagToolLlmResult,
        };
      }
    },

    component: RagToolResult,
  };
}
