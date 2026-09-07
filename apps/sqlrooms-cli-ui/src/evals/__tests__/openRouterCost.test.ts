import {describe, expect, it} from '@jest/globals';
import {createOpenRouterCostTracker} from '../openRouterCost';

const RATES = {
  inputCostUsdPerMillionTokens: 0.08,
  outputCostUsdPerMillionTokens: 0.18,
};

describe('createOpenRouterCostTracker', () => {
  it('accumulates provider-reported cost across streamed model calls', () => {
    const tracker = createOpenRouterCostTracker(RATES);
    const first = tracker.metadataExtractor.createStreamExtractor();
    first.processChunk({choices: [{delta: {content: 'Hello'}}]});
    first.processChunk({usage: {cost: 0.012}});
    expect(first.buildMetadata()).toEqual({
      openrouter: {costUsd: 0.012},
    });

    const second = tracker.metadataExtractor.createStreamExtractor();
    second.processChunk({usage: {cost: 0.003}});
    second.buildMetadata();

    expect(
      tracker.resolveCost({inputTokens: 1_000_000, outputTokens: 1_000_000}),
    ).toEqual({costUsd: 0.015, source: 'provider-reported'});
  });

  it('uses pinned model rates when OpenRouter omits billed cost', () => {
    const tracker = createOpenRouterCostTracker(RATES);

    expect(
      tracker.resolveCost({inputTokens: 2_000_000, outputTokens: 500_000}),
    ).toEqual({costUsd: 0.25, source: 'estimated'});
  });

  it('preserves a provider-reported zero cost', async () => {
    const tracker = createOpenRouterCostTracker(RATES);

    expect(
      await tracker.metadataExtractor.extractMetadata({
        parsedBody: {usage: {cost: 0}},
      }),
    ).toEqual({openrouter: {costUsd: 0}});
    expect(tracker.resolveCost({inputTokens: 10_000})).toEqual({
      costUsd: 0,
      source: 'provider-reported',
    });
  });

  it('falls back when one streamed response has usage but no cost', () => {
    const tracker = createOpenRouterCostTracker(RATES);
    const reported = tracker.metadataExtractor.createStreamExtractor();
    reported.processChunk({
      usage: {
        cost: 0.012,
        prompt_tokens: 1_000_000,
        completion_tokens: 500_000,
      },
    });
    reported.buildMetadata();
    const omitted = tracker.metadataExtractor.createStreamExtractor();
    omitted.processChunk({
      usage: {
        prompt_tokens: 500_000,
        completion_tokens: 1_000_000,
      },
    });
    omitted.buildMetadata();

    expect(
      tracker.resolveCost({inputTokens: 10_000, outputTokens: 10_000}),
    ).toEqual({costUsd: 0.39, source: 'estimated'});
  });
});
