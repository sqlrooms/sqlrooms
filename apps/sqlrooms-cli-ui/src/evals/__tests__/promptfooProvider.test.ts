import {afterAll, beforeEach, describe, expect, it, jest} from '@jest/globals';
import type {RunEvidence} from '@sqlrooms/evals';
import {CREATE_DOCUMENT_CHART_MAP_SCENARIO} from '../scenarios';

const runMock = jest.fn<() => Promise<RunEvidence>>();
const disposeMock = jest.fn<() => Promise<void>>();
const resolveCostMock =
  jest.fn<
    (
      usage: RunEvidence['usage'],
    ) =>
      | {costUsd: number; source: 'provider-reported' | 'estimated'}
      | undefined
  >();

jest.unstable_mockModule('../createCliEvalTarget', () => ({
  createCliEvalTarget: () => ({run: runMock, dispose: disposeMock}),
}));
jest.unstable_mockModule('../openRouterCost', () => ({
  createOpenRouterCostTracker: () => ({
    metadataExtractor: {},
    resolveCost: resolveCostMock,
  }),
}));
jest.unstable_mockModule('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: () => ({languageModel: () => ({})}),
}));

const {default: SqlroomsCliEvalProvider} = await import('../promptfooProvider');
const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;

function runEvidence(): RunEvidence {
  const timestamp = '2026-08-21T12:00:00.000Z';
  return {
    schemaVersion: 1,
    runId: 'provider-cost-test',
    scenario: {
      id: CREATE_DOCUMENT_CHART_MAP_SCENARIO.id,
      version: CREATE_DOCUMENT_CHART_MAP_SCENARIO.version,
      repetition: 0,
    },
    target: {
      type: 'cli-in-process',
      profileName: 'document-charts-maps',
      profileVersion: 1,
    },
    model: {
      provider: 'openrouter',
      modelId: 'test-model',
      settings: {},
    },
    timing: {startedAt: timestamp, endedAt: timestamp, latencyMs: 0},
    status: 'passed',
    promptTurns: CREATE_DOCUMENT_CHART_MAP_SCENARIO.turns,
    finalAnswer: 'Created a chart and map from analytics.events.',
    events: [],
    usage: {inputTokens: 100, outputTokens: 20, totalTokens: 120},
    oracleResults: [
      {
        oracleId: 'grounded-answer',
        kind: 'answer-grounding',
        pass: true,
        score: 1,
        reason: 'The answer is grounded.',
        evidence: {},
        metadata: {},
      },
    ],
    metadata: {},
  };
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'test-key';
  runMock.mockReset().mockResolvedValue(runEvidence());
  disposeMock.mockReset().mockResolvedValue(undefined);
  resolveCostMock.mockReset();
});

afterAll(() => {
  if (originalOpenRouterApiKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
  }
});

describe('SqlroomsCliEvalProvider cost propagation', () => {
  it.each([
    ['provider-reported', 0.012],
    ['estimated', 0.0000116],
  ] as const)(
    'returns %s cost and its evidence source',
    async (source, costUsd) => {
      resolveCostMock.mockReturnValue({costUsd, source});
      const provider = new SqlroomsCliEvalProvider({});

      const response = await provider.callApi(
        CREATE_DOCUMENT_CHART_MAP_SCENARIO.turns[0]!.input,
        {vars: {scenarioId: CREATE_DOCUMENT_CHART_MAP_SCENARIO.id}},
      );

      expect(response).toMatchObject({
        cost: costUsd,
        metadata: {
          sqlroomsEvidence: {
            usage: {costUsd},
            metadata: {cost: {source}},
          },
        },
      });
      expect(disposeMock).toHaveBeenCalledTimes(1);
    },
  );
});
