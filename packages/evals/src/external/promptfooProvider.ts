import type {RunEvidence} from '../evidence.js';
import {toPromptfooProviderResponse} from '../promptfoo/index.js';

/** Promptfoo `callApi` context fields used by the external provider. */
export type ExternalPromptfooCallContext = {
  vars?: Record<string, unknown>;
};

/** Promptfoo `callApi` options used by the external provider. */
export type ExternalPromptfooCallOptions = {
  /** Aborted when Promptfoo gives up on the test, for example on timeout. */
  abortSignal?: AbortSignal;
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
    callOptions?: ExternalPromptfooCallOptions,
  ): Promise<ExternalPromptfooResponse>;
};

/**
 * Wraps an external run as a Promptfoo custom provider.
 *
 * The run's evidence is stored in `metadata.sqlroomsEvidence`, so the
 * application's existing Promptfoo assertions can grade the final answer and
 * state. Harness errors and cancellations become Promptfoo errors, kept
 * separate from assertion failures. The error names only the status and
 * failure kind, never the harness's messages, so Promptfoo cannot mistake a
 * finished run for a rate limit and run it again; details stay in
 * `sqlroomsEvidence`. Promptfoo's abort signal is passed to `run`. Export the
 * returned factory's result as a provider module's default export.
 */
export function createExternalPromptfooProvider(options: {
  /** Default provider ID; Promptfoo's configured `id` takes precedence. */
  id: string;
  run(input: {
    prompt: string;
    vars: Record<string, unknown>;
    /** Forward to `runExternalScenario` so an abandoned test stops the harness. */
    signal?: AbortSignal;
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
      async callApi(prompt, context, callOptions) {
        const evidence = await options.run({
          prompt,
          vars: context?.vars ?? {},
          signal: callOptions?.abortSignal,
        });
        const response = toPromptfooProviderResponse(evidence);
        // The validated evidence envelope wins over callback keys.
        const metadata = {
          ...options.metadata?.(evidence),
          ...response.metadata,
        };
        if (evidence.status === 'error' || evidence.status === 'cancelled') {
          const failureKind = evidence.metadata.failureKind;
          return {
            output: response.output,
            metadata,
            error: `External run ${evidence.status} (${String(failureKind ?? 'unknown')}); see sqlroomsEvidence for details.`,
          };
        }
        return {output: response.output, metadata};
      },
    };
  };
}
