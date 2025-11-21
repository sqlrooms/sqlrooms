import {embed} from 'ai';
import type {EmbeddingProvider} from './RagSlice';

/**
 * Provider instance from Vercel AI SDK (e.g., openai, google, anthropic).
 * This is an interface with an embedding method for v2 models.
 */
export interface AiProvider {
  embedding(modelId: string, settings?: {dimensions?: number}): any;
}

/**
 * Factory function that creates a provider instance, optionally with an API key.
 * This allows creating providers dynamically at runtime with user-provided API keys.
 */
export type AiProviderFactory = (apiKey?: string) => AiProvider;

/**
 * Create an embedding provider using Vercel AI SDK.
 *
 * This is a generic function that works with any provider from the Vercel AI SDK:
 * - OpenAI (@ai-sdk/openai)
 * - Google (@ai-sdk/google)
 * - Anthropic (@ai-sdk/anthropic)
 * - Custom providers
 *
 * Supports both static providers and dynamic provider factories for runtime API key configuration.
 *
 * IMPORTANT: The model and dimensions MUST match the ones used during database preparation.
 * Check your database metadata to ensure compatibility.
 *
 * @param providerOrFactory - Provider instance or factory function that creates a provider
 * @param modelId - Model identifier (e.g., 'text-embedding-3-small', 'text-embedding-004')
 * @param dimensions - Embedding dimensions (optional, defaults to model's native dimensions)
 * @param getApiKey - Optional function to retrieve API key at runtime (for dynamic provider factories)
 * @returns EmbeddingProvider function
 *
 * @example Static provider (uses environment variables)
 * ```typescript
 * import {openai} from '@ai-sdk/openai';
 * import {createAiEmbeddingProvider} from '@sqlrooms/ai-rag';
 *
 * // OpenAI text-embedding-3-small (1536 dimensions)
 * const provider = createAiEmbeddingProvider(
 *   openai,
 *   'text-embedding-3-small',
 *   1536
 * );
 * ```
 *
 * @example Dynamic provider with runtime API key
 * ```typescript
 * import {createOpenAI} from '@ai-sdk/openai';
 * import {createAiEmbeddingProvider} from '@sqlrooms/ai-rag';
 *
 * // Provider factory that creates OpenAI instance with runtime API key
 * const provider = createAiEmbeddingProvider(
 *   (apiKey) => createOpenAI({apiKey}),
 *   'text-embedding-3-small',
 *   1536,
 *   () => store.getState().aiSettings.config.providers?.['openai']?.apiKey
 * );
 * ```
 *
 * @note Requires AI SDK 5+ which uses v2 embedding specification.
 * The provider must support the `embedding()` method that returns a v2 model.
 */
export function createAiEmbeddingProvider(
  providerOrFactory: AiProvider | AiProviderFactory,
  modelId: string,
  dimensions?: number,
  getApiKey?: () => string | undefined,
): EmbeddingProvider {
  return async (text: string): Promise<number[]> => {
    try {
      // Get API key if getter is provided
      const apiKey = getApiKey?.();

      // Determine if we have a provider or a factory
      const provider =
        typeof providerOrFactory === 'function'
          ? providerOrFactory(apiKey)
          : providerOrFactory;

      // Use v2 embedding API (required for AI SDK 5+)
      const embeddingModel = provider.embedding(modelId, {
        dimensions,
      });

      const {embedding} = await embed({
        model: embeddingModel,
        value: text,
      });

      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(
        `Failed to generate embedding with ${modelId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  };
}
