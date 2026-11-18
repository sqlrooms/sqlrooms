import type {RunEvidence} from '../evidence.js';
import {toPromptfooProviderResponse} from '../promptfoo/index.js';

/** Promptfoo `callApi` context fields used by the external provider. */
export type ExternalPromptfooCallContext = {
  vars?: Record<string, unknown>;
};

/** Promptfoo provider response, with an `error` for harness errors. */
export type ExternalPromptfooResponse = {
  output: string;
  metadata: Record<string, unknown>;
  error?: string;
};

/** A Promptfoo custom provider instance. */
export type ExternalPromptfooProvider = {
  id(): string;
  callApi(
    prompt: string,
    context?: ExternalPromptfooCallContext,
  ): Promise<ExternalPromptfooResponse>;
};

/**
 * Wraps an external run as a Promptfoo custom provider.
 *
 * The run's evidence is stored in `metadata.sqlroomsEvidence`, so the
 * application's existing Promptfoo assertions can grade the final answer and
 * state. Harness errors and cancellations become Promptfoo errors, kept
 * separate from assertion failures. Export the returned factory's result as a
 * provider module's default export.
 */
export function createExternalPromptfooProvider(options: {
  /** Default provider ID; Promptfoo's configured `id` takes precedence. */
  id: string;
  run(input: {
    prompt: string;
    vars: Record<string, unknown>;
  }): Promise<RunEvidence>;
  /** Extra provider metadata derived from the evidence, such as an app snapshot. */
  metadata?(evidence: RunEvidence): Record<string, unknown>;
}) {
  return function ExternalProvider(
    this: unknown,
    providerOptions?: {id?: string},
  ): ExternalPromptfooProvider {
    const providerId = providerOptions?.id ?? options.id;
    return {
      id: () => providerId,
      async callApi(prompt, context) {
        const evidence = await options.run({prompt, vars: context?.vars ?? {}});
        const response = toPromptfooProviderResponse(evidence);
        const metadata = {
          ...response.metadata,
          ...options.metadata?.(evidence),
        };
        if (evidence.status === 'error' || evidence.status === 'cancelled') {
          const failureKind = evidence.metadata.failureKind;
          const messages = evidence.events
            .filter((event) => event.type === 'error')
            .map((event) => String(event.data.message ?? event.name));
          return {
            output: response.output,
            metadata,
            error: `External run ${evidence.status} (${String(failureKind ?? 'unknown')}): ${messages.join('; ')}`,
          };
        }
        return {output: response.output, metadata};
      },
    };
  };
}
