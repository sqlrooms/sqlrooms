import {openai, createOpenAI} from '@ai-sdk/openai';
import {createAiEmbeddingProvider} from '@sqlrooms/rag';
import type {EmbeddingProvider} from '@sqlrooms/rag';

/**
 * Create an OpenAI embedding provider using Vercel AI SDK.
 *
 * IMPORTANT: The model and dimensions MUST match the ones used during database preparation.
 * Check your database metadata to ensure compatibility.
 *
 * @param model - OpenAI model name (default: "text-embedding-3-small")
 * @param dimensions - Embedding dimensions (optional, defaults to model's native dimensions)
 * @param getApiKey - Optional function to retrieve API key at runtime from settings
 * @returns EmbeddingProvider function
 *
 * @example Static API key (from environment)
 * ```typescript
 * const provider = createOpenAIEmbeddingProvider(
 *   'text-embedding-3-small',
 *   1536  // Match the dimension used during preparation
 * );
 * ```
 *
 * @example Dynamic API key (from user settings)
 * ```typescript
 * const provider = createOpenAIEmbeddingProvider(
 *   'text-embedding-3-small',
 *   1536,
 *   () => store.getState().aiSettings.config.providers?.['openai']?.apiKey
 * );
 * ```
 */
export function createOpenAIEmbeddingProvider(
  model: string = 'text-embedding-3-small',
  dimensions?: number,
  getApiKey?: () => string | undefined,
): EmbeddingProvider {
  // If getApiKey is provided, use a factory function to create the provider dynamically
  // Otherwise, use the static openai instance (which uses OPENAI_API_KEY env var)
  const providerOrFactory = getApiKey
    ? (apiKey?: string) => createOpenAI({apiKey})
    : openai;

  return createAiEmbeddingProvider(
    providerOrFactory,
    model,
    dimensions,
    getApiKey,
  );
}
