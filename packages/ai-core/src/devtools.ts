import type {LanguageModel, LanguageModelMiddleware} from 'ai';
import {wrapLanguageModel} from 'ai';

type WrapGenerateOptions = Parameters<
  NonNullable<LanguageModelMiddleware['wrapGenerate']>
>[0];
type WrapStreamOptions = Parameters<
  NonNullable<LanguageModelMiddleware['wrapStream']>
>[0];
type LanguageModelCallOptions = WrapGenerateOptions['params'];
type MiddlewareModel = WrapGenerateOptions['model'];
type GenerateResult = Awaited<ReturnType<WrapGenerateOptions['doGenerate']>>;
type StreamResult = Awaited<ReturnType<WrapStreamOptions['doStream']>>;
type StreamPart = StreamResult extends {stream: ReadableStream<infer T>}
  ? T
  : never;

type SqlroomsAiDevtoolsConfig = {
  enabled?: boolean;
  endpoint?: string;
};

type SqlroomsAiDevtoolsGlobal = typeof globalThis & {
  __SQLROOMS_AI_DEVTOOLS__?: SqlroomsAiDevtoolsConfig;
};

type DevtoolsContext = {
  label?: string;
  sessionId?: string;
  provider?: string;
  modelId?: string;
};

type DevtoolsStep = {
  id: string;
  run_id: string;
  step_number: number;
  type: 'generate' | 'stream';
  model_id: string;
  provider: string | null;
  started_at: string;
  input: string;
  provider_options: string | null;
  duration_ms: number | null;
  output: string | null;
  usage: string | null;
  error: string | null;
  raw_request: string | null;
  raw_response: string | null;
  raw_chunks: string | null;
};

type DevtoolsEvent =
  | {type: 'create-run'; run: {id: string; started_at: string}}
  | {type: 'create-step'; step: DevtoolsStep}
  | {type: 'update-step'; stepId: string; patch: Partial<DevtoolsStep>};

type StreamOutput = {
  textParts: Array<{id: string; text: string}>;
  reasoningParts: Array<{id: string; text: string}>;
  toolCalls: unknown[];
  finishReason?: unknown;
  usage?: unknown;
};

function getDevtoolsConfig(): SqlroomsAiDevtoolsConfig | undefined {
  return (globalThis as SqlroomsAiDevtoolsGlobal).__SQLROOMS_AI_DEVTOOLS__;
}

function getDevtoolsEndpoint(): string | undefined {
  const config = getDevtoolsConfig();
  if (!config?.enabled) return undefined;
  return config.endpoint ?? '/__sqlrooms_ai_devtools';
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function generateRunId(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 17);
  return `${timestamp}-${generateId().slice(0, 8)}`;
}

function safeStringify(value: unknown): string | null {
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(String(value));
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function postDevtoolsEvent(event: DevtoolsEvent): Promise<void> {
  const endpoint = getDevtoolsEndpoint();
  if (!endpoint || typeof fetch !== 'function') return;

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(event),
    });
  } catch {
    // DevTools must never affect an AI call.
  }
}

function createStep({
  runId,
  stepNumber,
  type,
  params,
  model,
  context,
}: {
  runId: string;
  stepNumber: number;
  type: 'generate' | 'stream';
  params: LanguageModelCallOptions;
  model: MiddlewareModel;
  context?: DevtoolsContext;
}): DevtoolsStep {
  return {
    id: generateId(),
    run_id: runId,
    step_number: stepNumber,
    type,
    model_id: context?.modelId ?? model.modelId,
    provider: context?.provider ?? model.provider ?? null,
    started_at: new Date().toISOString(),
    input: safeStringify({
      label: context?.label,
      sessionId: context?.sessionId,
      prompt: params.prompt,
      tools: params.tools,
      toolChoice: params.toolChoice,
      maxOutputTokens: params.maxOutputTokens,
      temperature: params.temperature,
      topP: params.topP,
      topK: params.topK,
      presencePenalty: params.presencePenalty,
      frequencyPenalty: params.frequencyPenalty,
      seed: params.seed,
      responseFormat: params.responseFormat,
    })!,
    provider_options: safeStringify(params.providerOptions),
    duration_ms: null,
    output: null,
    usage: null,
    error: null,
    raw_request: null,
    raw_response: null,
    raw_chunks: null,
  };
}

function createBrowserDevtoolsMiddleware(
  context?: DevtoolsContext,
): LanguageModelMiddleware {
  const runId = generateRunId();
  let runCreated = false;
  let stepCounter = 0;

  const ensureRun = async () => {
    if (runCreated) return;
    runCreated = true;
    await postDevtoolsEvent({
      type: 'create-run',
      run: {id: runId, started_at: new Date().toISOString()},
    });
  };

  const beginStep = async (
    type: 'generate' | 'stream',
    params: LanguageModelCallOptions,
    model: MiddlewareModel,
  ) => {
    await ensureRun();
    const step = createStep({
      runId,
      stepNumber: ++stepCounter,
      type,
      params,
      model,
      context,
    });
    await postDevtoolsEvent({type: 'create-step', step});
    return step;
  };

  return {
    specificationVersion: 'v3',
    wrapGenerate: async ({doGenerate, params, model}) => {
      const startedAt = Date.now();
      const step = await beginStep('generate', params, model);
      try {
        const result = (await doGenerate()) as GenerateResult;
        await postDevtoolsEvent({
          type: 'update-step',
          stepId: step.id,
          patch: {
            duration_ms: Date.now() - startedAt,
            output: safeStringify({
              content: result.content,
              finishReason: result.finishReason,
              response: result.response,
            }),
            usage: safeStringify(result.usage),
            error: null,
            raw_request: safeStringify(result.request?.body),
            raw_response: safeStringify(result.response?.body),
          },
        });
        return result;
      } catch (error) {
        await postDevtoolsEvent({
          type: 'update-step',
          stepId: step.id,
          patch: {
            duration_ms: Date.now() - startedAt,
            output: null,
            usage: null,
            error: getErrorMessage(error),
          },
        });
        throw error;
      }
    },
    wrapStream: async ({doStream, params, model}) => {
      const startedAt = Date.now();
      const step = await beginStep('stream', params, model);
      const userRequestedRawChunks = params.includeRawChunks === true;
      params.includeRawChunks = true;

      try {
        const {stream, request, response, ...rest} =
          (await doStream()) as StreamResult;
        const output: StreamOutput = {
          textParts: [],
          reasoningParts: [],
          toolCalls: [],
        };
        const textById = new Map<string, string>();
        const reasoningById = new Map<string, string>();
        const fullStreamChunks: StreamPart[] = [];
        const rawChunks: unknown[] = [];

        const finishStep = async (error?: string) => {
          await postDevtoolsEvent({
            type: 'update-step',
            stepId: step.id,
            patch: {
              duration_ms: Date.now() - startedAt,
              output: safeStringify(output),
              usage: safeStringify(output.usage),
              error: error ?? null,
              raw_request: safeStringify(request?.body),
              raw_response: safeStringify(fullStreamChunks),
              raw_chunks: safeStringify(rawChunks),
            },
          });
        };

        const transformStream = new TransformStream<StreamPart, StreamPart>({
          transform(chunk, controller) {
            if (chunk.type === 'raw') {
              rawChunks.push(chunk.rawValue);
              if (userRequestedRawChunks) controller.enqueue(chunk);
              return;
            }

            fullStreamChunks.push(chunk);
            switch (chunk.type) {
              case 'text-start':
                textById.set(chunk.id, '');
                break;
              case 'text-delta':
                textById.set(
                  chunk.id,
                  `${textById.get(chunk.id) ?? ''}${chunk.delta}`,
                );
                break;
              case 'text-end':
                output.textParts.push({
                  id: chunk.id,
                  text: textById.get(chunk.id) ?? '',
                });
                break;
              case 'reasoning-start':
                reasoningById.set(chunk.id, '');
                break;
              case 'reasoning-delta':
                reasoningById.set(
                  chunk.id,
                  `${reasoningById.get(chunk.id) ?? ''}${chunk.delta}`,
                );
                break;
              case 'reasoning-end':
                output.reasoningParts.push({
                  id: chunk.id,
                  text: reasoningById.get(chunk.id) ?? '',
                });
                break;
              case 'tool-call':
                output.toolCalls.push(chunk);
                break;
              case 'finish':
                output.finishReason = chunk.finishReason;
                output.usage = chunk.usage;
                break;
            }
            controller.enqueue(chunk);
          },
          flush: () => finishStep(),
        });

        return {
          stream: stream.pipeThrough(transformStream),
          request,
          response,
          ...rest,
        };
      } catch (error) {
        await postDevtoolsEvent({
          type: 'update-step',
          stepId: step.id,
          patch: {
            duration_ms: Date.now() - startedAt,
            output: null,
            usage: null,
            error: getErrorMessage(error),
          },
        });
        throw error;
      }
    },
  };
}

export function wrapModelWithSqlroomsAiDevtools(
  model: LanguageModel,
  context?: DevtoolsContext,
): LanguageModel {
  if (!getDevtoolsEndpoint()) return model;
  if (
    typeof model !== 'object' ||
    model === null ||
    !('specificationVersion' in model) ||
    model.specificationVersion !== 'v3'
  ) {
    return model;
  }

  return wrapLanguageModel({
    model: model as MiddlewareModel,
    middleware: createBrowserDevtoolsMiddleware(context),
  });
}
