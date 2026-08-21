import {
  createOpenAICompatible,
  type MetadataExtractor,
} from '@ai-sdk/openai-compatible';
import {
  toPromptfooAssertionResult,
  toPromptfooProviderResponse,
} from '@sqlrooms/evals/promptfoo';
import type {LanguageModel} from 'ai';
import {createCliEvalTarget} from './createCliEvalTarget';
import {loadLocalEvalEnvironment} from './loadLocalEvalEnvironment';
import {createOpenRouterCostTracker} from './openRouterCost';
import {CLI_BEHAVIORAL_SCENARIOS, createCliScenarioOracles} from './scenarios';

loadLocalEvalEnvironment();

const MODEL_ID = 'deepseek/deepseek-v4-flash-0731';
const MODEL_INPUT_COST_USD_PER_MILLION_TOKENS = 0.08;
const MODEL_OUTPUT_COST_USD_PER_MILLION_TOKENS = 0.18;
const MAX_STEPS = 24;
const TEMPERATURE = 0;

type PromptfooProviderOptions = {
  id?: string;
};

type PromptfooCallContext = {
  vars?: Record<string, unknown>;
  repeatIndex?: number;
};

type PromptfooProviderResponse = {
  output?: string;
  error?: string;
  tokenUsage?: {prompt?: number; completion?: number; total?: number};
  cost?: number;
  metadata?: Record<string, unknown>;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it before running the SQLRooms nightly eval suite.`,
    );
  }
  return value;
}

function createPinnedOpenRouterModel(
  metadataExtractor: MetadataExtractor,
): LanguageModel {
  const provider = createOpenAICompatible({
    name: 'openrouter',
    apiKey: requiredEnvironment('OPENROUTER_API_KEY'),
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': 'https://github.com/sqlrooms/sqlrooms',
      'X-Title': 'SQLRooms behavioral evals',
    },
    metadataExtractor,
  });
  return provider.languageModel(MODEL_ID, {
    transformRequestBody: (body) => ({...body, temperature: TEMPERATURE}),
  }) as LanguageModel;
}

function repositoryMetadata() {
  const serverUrl = process.env.GITHUB_SERVER_URL;
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  return {
    commitSha: process.env.GITHUB_SHA ?? 'local',
    dirty: !process.env.GITHUB_SHA,
    ...(serverUrl && repository && runId
      ? {workflowUrl: `${serverUrl}/${repository}/actions/runs/${runId}`}
      : {}),
  };
}

/** Promptfoo provider that runs one production SQLRooms behavioral scenario. */
export default class SqlroomsCliEvalProvider {
  private readonly providerId: string;

  constructor(options: PromptfooProviderOptions) {
    this.providerId = options.id ?? 'sqlrooms-cli-openrouter';
  }

  id(): string {
    return this.providerId;
  }

  async callApi(
    prompt: string,
    context?: PromptfooCallContext,
  ): Promise<PromptfooProviderResponse> {
    const scenarioId = String(context?.vars?.scenarioId ?? '');
    const scenario = CLI_BEHAVIORAL_SCENARIOS.find(
      (candidate) => candidate.id === scenarioId,
    );
    if (!scenario) {
      return {
        error: `Unknown SQLRooms scenario ${JSON.stringify(scenarioId)}.`,
        metadata: {failureKind: 'harness'},
      };
    }
    if (prompt !== scenario.turns[0]?.input) {
      return {
        error: `Promptfoo prompt drifted from pinned scenario ${scenario.id}.`,
        metadata: {failureKind: 'harness'},
      };
    }

    const repeatIndex = context?.repeatIndex ?? 0;
    const costTracker = createOpenRouterCostTracker({
      inputCostUsdPerMillionTokens: MODEL_INPUT_COST_USD_PER_MILLION_TOKENS,
      outputCostUsdPerMillionTokens: MODEL_OUTPUT_COST_USD_PER_MILLION_TOKENS,
    });
    const target = createCliEvalTarget({
      model: createPinnedOpenRouterModel(costTracker.metadataExtractor),
      modelProvider: 'openrouter',
      modelId: MODEL_ID,
      configuredRevision: MODEL_ID,
      modelSettings: {temperature: TEMPERATURE, maxSteps: MAX_STEPS},
      maxSteps: MAX_STEPS,
      repository: repositoryMetadata(),
      sensitiveValues: [process.env.OPENROUTER_API_KEY ?? ''],
      timeoutMs: 180_000,
    });

    try {
      const runEvidence = await target.run({
        scenario,
        oracles: createCliScenarioOracles(scenario),
        repetition: repeatIndex,
      });
      const cost = costTracker.resolveCost(runEvidence.usage);
      const evidence = cost
        ? {
            ...runEvidence,
            usage: {...runEvidence.usage, costUsd: cost.costUsd},
            metadata: {
              ...runEvidence.metadata,
              cost: {source: cost.source},
            },
          }
        : runEvidence;
      const response = toPromptfooProviderResponse(evidence);
      const assertion = toPromptfooAssertionResult(evidence.oracleResults);
      return {
        output: response.output,
        tokenUsage: evidence.usage
          ? {
              prompt: evidence.usage.inputTokens,
              completion: evidence.usage.outputTokens,
              total: evidence.usage.totalTokens,
            }
          : undefined,
        cost: evidence.usage?.costUsd,
        metadata: {
          ...response.metadata,
          sqlroomsAssertion: assertion,
          ...(evidence.status === 'passed'
            ? {}
            : {
                failureKind:
                  evidence.status === 'error'
                    ? 'provider-or-target'
                    : 'behavior',
              }),
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        metadata: {failureKind: 'provider-or-target'},
      };
    } finally {
      await target.dispose();
    }
  }
}
