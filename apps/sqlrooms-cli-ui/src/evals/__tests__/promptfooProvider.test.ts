import {afterAll, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {RUN_EVIDENCE_SCHEMA_VERSION, type RunEvidence} from '@sqlrooms/evals';
import {CREATE_DOCUMENT_CHART_MAP_SCENARIO} from '../scenarios';

const runMock = jest.fn<() => Promise<RunEvidence>>();
const disposeMock = jest.fn<() => Promise<void>>();
const createTargetMock = jest.fn<
  (options: unknown) => {run: typeof runMock; dispose: typeof disposeMock}
>(() => ({run: runMock, dispose: disposeMock}));
const costOptionsMock = jest.fn<(options: unknown) => void>();
const languageModelMock = jest.fn<(id: string, options: unknown) => object>(
  () => ({}),
);
const resolveCostMock =
  jest.fn<
    (
      usage: RunEvidence['usage'],
    ) =>
      | {costUsd: number; source: 'provider-reported' | 'estimated'}
      | undefined
  >();

jest.unstable_mockModule('../createCliEvalTarget', () => ({
  createCliEvalTarget: createTargetMock,
}));
jest.unstable_mockModule('../openRouterCost', () => ({
  createOpenRouterCostTracker: (options: unknown) => {
    costOptionsMock(options);
    return {
      metadataExtractor: {},
      resolveCost: resolveCostMock,
    };
  },
}));
jest.unstable_mockModule('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: () => ({languageModel: languageModelMock}),
}));

const {default: SqlroomsCliEvalProvider} = await import('../promptfooProvider');
const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
const originalEvalModel = process.env.SQLROOMS_EVAL_MODEL;

function runEvidence(): RunEvidence {
  const timestamp = '2026-08-21T12:00:00.000Z';
  return {
    schemaVersion: RUN_EVIDENCE_SCHEMA_VERSION,
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
    checkResults: [
      {
        checkId: 'grounded-answer',
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
  createTargetMock.mockClear();
  costOptionsMock.mockClear();
  languageModelMock.mockClear();
  delete process.env.SQLROOMS_EVAL_MODEL;
});

afterAll(() => {
  if (originalOpenRouterApiKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
  }
  if (originalEvalModel === undefined) delete process.env.SQLROOMS_EVAL_MODEL;
  else process.env.SQLROOMS_EVAL_MODEL = originalEvalModel;
});

describe('SqlroomsCliEvalProvider cost propagation', () => {
  it('passes the selected model into the target and evidence identity', async () => {
    process.env.SQLROOMS_EVAL_MODEL = 'openai/gpt-5.5';
    const provider = new SqlroomsCliEvalProvider({});
    await provider.callApi(CREATE_DOCUMENT_CHART_MAP_SCENARIO.turns[0]!.input, {
      vars: {scenarioId: CREATE_DOCUMENT_CHART_MAP_SCENARIO.id},
    });
    expect(createTargetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelProvider: 'openrouter',
        modelId: 'openai/gpt-5.5',
        configuredRevision: 'openai/gpt-5.5',
      }),
    );
    expect(languageModelMock).toHaveBeenCalledWith(
      'openai/gpt-5.5',
      expect.any(Object),
    );
    expect(costOptionsMock).toHaveBeenCalledWith(undefined);
  });

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
