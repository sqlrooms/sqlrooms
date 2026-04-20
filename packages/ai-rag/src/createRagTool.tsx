import {tool} from 'ai';
import type {ToolRendererProps} from '@sqlrooms/ai-core';
import {Button} from '@sqlrooms/ui';
import {useState} from 'react';
import {z} from 'zod';
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

export type RagToolOutput = RagToolLlmResult;

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
    <div>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {isExpanded ? '▼' : '▶'} Result #{index + 1}
        </span>
        <span className="text-muted-foreground/50 text-xs">
          Score: {result.score.toFixed(3)}
        </span>
      </Button>

      {isExpanded && (
        <p className="text-muted-foreground/50 p-5 font-mono text-xs whitespace-pre-wrap">
          {result.text}
        </p>
      )}
    </div>
  );
}

/**
 * Result component for displaying RAG search results
 */
function RagToolResult({output}: ToolRendererProps<RagToolOutput>) {
  if (!output?.success) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-3 text-red-600 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
        <p className="text-xs font-semibold">RAG Search Failed</p>
        <p className="text-xs">{output?.error || 'Unknown error'}</p>
      </div>
    );
  }

  const {results} = output;

  return (
    <details className="text-xs" open>
      <summary className="text-muted-foreground cursor-pointer py-1 text-xs font-medium">
        Found {results?.length || 0} results
      </summary>
      <div className="space-y-2 p-3">
        <div className="space-y-2">
          {results &&
            results.map((result, i) => (
              <RagResultItem key={i} result={result} index={i} />
            ))}
        </div>
      </div>
    </details>
  );
}

/** Tool renderer component for use in `toolRenderers` registry. */
export const ragToolRenderer = RagToolResult;

/**
 * Execute a RAG search against a given rag slice state.
 * Can be called directly (e.g. from UI components) without going through the AI tool layer.
 */
export async function executeRagSearch(
  params: RagToolParameters,
  state: RagSliceState,
): Promise<RagToolOutput> {
  const {query, database, topK = 5} = params;

  try {
    await state.rag.initialize();

    const clampedTopK = Math.min(Math.max(1, topK), 20);
    const targetDatabase = database || state.rag.listDatabases()[0];

    if (!targetDatabase) {
      return {success: false, error: 'No RAG databases configured'};
    }

    const results = await state.rag.queryByText(query, {
      topK: clampedTopK,
      database: targetDatabase,
    });

    const formattedContext = results
      .map(
        (result, i) =>
          `[Result ${i + 1}] (Score: ${result.score.toFixed(3)})\n${result.text}`,
      )
      .join('\n\n---\n\n');

    return {
      success: true,
      query,
      database: targetDatabase,
      results: results.map((r) => ({
        text: r.text,
        score: r.score,
        metadata: r.metadata,
      })),
      context: formattedContext,
      details: `Found ${results.length} relevant documents in ${targetDatabase}`,
    };
  } catch (error) {
    console.error('RAG search error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
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
export function createRagTool() {
  return tool({
    description: `Search through documentation and knowledge bases using semantic search.

Use this tool when you need to:
- Find specific information in documentation
- Look up API references or technical details
- Get context about features, functions, or concepts
- Answer questions that require domain knowledge

The search uses vector embeddings to find semantically similar content, not just keyword matching.`,

    inputSchema: RagToolParameters,

    toModelOutput: ({output}) => ({
      type: 'text',
      value: JSON.stringify({
        success: output.success,
        ...(output.error ? {error: output.error} : {}),
        ...(output.query ? {query: output.query} : {}),
        ...(output.database ? {database: output.database} : {}),
        ...(output.context ? {context: output.context} : {}),
        ...(output.details ? {details: output.details} : {}),
      }),
    }),

    execute: async (params: RagToolParameters): Promise<RagToolOutput> => {
      const store = (globalThis as any).__ROOM_STORE__;
      if (!store) {
        return {success: false, error: 'Store not available'};
      }
      return executeRagSearch(params, store.getState() as RagSliceState);
    },
  });
}
