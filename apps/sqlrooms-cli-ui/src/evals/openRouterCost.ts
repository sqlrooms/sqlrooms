import type {MetadataExtractor} from '@ai-sdk/openai-compatible';

type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export type OpenRouterCost = {
  costUsd: number;
  source: 'provider-reported' | 'estimated';
};

export type OpenRouterCostTrackerOptions = {
  inputCostUsdPerMillionTokens: number;
  outputCostUsdPerMillionTokens: number;
};

function reportedCostUsd(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const usage = (value as {usage?: unknown}).usage;
  if (!usage || typeof usage !== 'object') return undefined;
  const cost = (usage as {cost?: unknown}).cost;
  return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0
    ? cost
    : undefined;
}

function reportedTokenUsage(value: unknown): TokenUsage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const usage = (value as {usage?: unknown}).usage;
  if (!usage || typeof usage !== 'object') return undefined;
  const {prompt_tokens: inputTokens, completion_tokens: outputTokens} =
    usage as {
      prompt_tokens?: unknown;
      completion_tokens?: unknown;
    };
  const validInputTokens =
    typeof inputTokens === 'number' &&
    Number.isFinite(inputTokens) &&
    inputTokens >= 0
      ? inputTokens
      : undefined;
  const validOutputTokens =
    typeof outputTokens === 'number' &&
    Number.isFinite(outputTokens) &&
    outputTokens >= 0
      ? outputTokens
      : undefined;
  return validInputTokens === undefined && validOutputTokens === undefined
    ? undefined
    : {inputTokens: validInputTokens, outputTokens: validOutputTokens};
}

function estimatedCostUsd(
  usage: TokenUsage | undefined,
  options: OpenRouterCostTrackerOptions,
): number | undefined {
  if (!usage) return undefined;
  return (
    ((usage.inputTokens ?? 0) * options.inputCostUsdPerMillionTokens) /
      1_000_000 +
    ((usage.outputTokens ?? 0) * options.outputCostUsdPerMillionTokens) /
      1_000_000
  );
}

/** Collects OpenRouter's billed cost from AI SDK response metadata. */
export function createOpenRouterCostTracker(
  options: OpenRouterCostTrackerOptions,
): {
  metadataExtractor: MetadataExtractor;
  resolveCost(usage: TokenUsage | undefined): OpenRouterCost | undefined;
} {
  let totalReportedCostUsd: number | undefined;
  let totalReportedUsage: TokenUsage | undefined;
  let usageWithoutReportedCost = false;

  const record = (
    costUsd: number | undefined,
    usage: TokenUsage | undefined,
  ) => {
    if (costUsd !== undefined) {
      totalReportedCostUsd = (totalReportedCostUsd ?? 0) + costUsd;
    }
    if (usage) {
      totalReportedUsage = {
        inputTokens:
          (totalReportedUsage?.inputTokens ?? 0) + (usage.inputTokens ?? 0),
        outputTokens:
          (totalReportedUsage?.outputTokens ?? 0) + (usage.outputTokens ?? 0),
      };
    }
  };

  return {
    metadataExtractor: {
      async extractMetadata({parsedBody}) {
        const costUsd = reportedCostUsd(parsedBody);
        const usage = reportedTokenUsage(parsedBody);
        if (
          costUsd === undefined &&
          parsedBody &&
          typeof parsedBody === 'object' &&
          (parsedBody as {usage?: unknown}).usage
        ) {
          usageWithoutReportedCost = true;
        }
        record(costUsd, usage);
        return costUsd === undefined ? undefined : {openrouter: {costUsd}};
      },
      createStreamExtractor() {
        let costUsd: number | undefined;
        let usage: TokenUsage | undefined;
        let sawUsage = false;
        return {
          processChunk(parsedChunk) {
            sawUsage ||= Boolean(
              parsedChunk &&
              typeof parsedChunk === 'object' &&
              (parsedChunk as {usage?: unknown}).usage,
            );
            costUsd = reportedCostUsd(parsedChunk) ?? costUsd;
            usage = reportedTokenUsage(parsedChunk) ?? usage;
          },
          buildMetadata() {
            if (sawUsage && costUsd === undefined) {
              usageWithoutReportedCost = true;
            }
            record(costUsd, usage);
            return costUsd === undefined ? undefined : {openrouter: {costUsd}};
          },
        };
      },
    },
    resolveCost(usage) {
      if (totalReportedCostUsd !== undefined && !usageWithoutReportedCost) {
        return {
          costUsd: totalReportedCostUsd,
          source: 'provider-reported',
        };
      }
      const costUsd = estimatedCostUsd(totalReportedUsage ?? usage, options);
      return costUsd === undefined ? undefined : {costUsd, source: 'estimated'};
    },
  };
}
