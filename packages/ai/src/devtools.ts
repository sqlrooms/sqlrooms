import {
  wrapLanguageModel,
  type LanguageModel,
  type LanguageModelMiddleware,
} from 'ai';

type WrappableLanguageModel = Parameters<typeof wrapLanguageModel>[0]['model'];
type MiddlewareParams = Parameters<
  NonNullable<LanguageModelMiddleware['wrapStream']>
>[0]['params'];
type MiddlewareModel = Parameters<
  NonNullable<LanguageModelMiddleware['wrapStream']>
>[0]['model'];
type StreamPart =
  Awaited<
    ReturnType<
      Parameters<
        NonNullable<LanguageModelMiddleware['wrapStream']>
      >[0]['doStream']
    >
  >['stream'] extends ReadableStream<infer T>
    ? T
    : never;
type DevToolsModule = {
  devToolsMiddleware: () => LanguageModelMiddleware;
};

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

const AI_SDK_DEVTOOLS_PACKAGE = '@ai-sdk/devtools';
const DEFAULT_BROWSER_BRIDGE_URL = 'http://127.0.0.1:4984';

const getProcess = (): ProcessLike | undefined => {
  const maybeGlobal = globalThis as typeof globalThis & {
    process?: ProcessLike;
  };
  return maybeGlobal.process;
};

export function isAiSdkDevToolsEnabled(): boolean {
  const env = getProcess()?.env;
  const importMetaEnv = (
    import.meta as ImportMeta & {
      env?: Record<string, string | boolean | undefined>;
    }
  ).env;

  return (
    (env?.SQLROOMS_AI_SDK_DEVTOOLS === '1' ||
      importMetaEnv?.VITE_SQLROOMS_AI_SDK_DEVTOOLS === '1') &&
    env?.NODE_ENV !== 'production'
  );
}

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getBrowserBridgeUrl(): string {
  const importMetaEnv = (
    import.meta as ImportMeta & {
      env?: Record<string, string | boolean | undefined>;
    }
  ).env;
  const configured = importMetaEnv?.VITE_AI_SDK_DEVTOOLS_BRIDGE_URL;
  return typeof configured === 'string' && configured.trim()
    ? configured
    : DEFAULT_BROWSER_BRIDGE_URL;
}

function getModelProvider(model: MiddlewareModel): string | null {
  const config = (model as unknown as {config?: {provider?: unknown}}).config;
  return typeof config?.provider === 'string' ? config.provider : null;
}

function stringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({error: 'Unable to serialize value'});
  }
}

function getStepInput(params: MiddlewareParams): string {
  return (
    stringify({
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
    }) ?? '{}'
  );
}

async function postToBridge(path: string, body: unknown): Promise<void> {
  try {
    await fetch(`${getBrowserBridgeUrl()}${path}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: stringify(body),
    });
  } catch {
    // DevTools capture should never break the chat path.
  }
}

function generateRunId(): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 17);
  const uniqueId = crypto.randomUUID().slice(0, 8);
  return `${timestamp}-${uniqueId}`;
}

function getBrowserDevToolsMiddleware(): LanguageModelMiddleware {
  const runId = generateRunId();
  let runCreated = false;
  let stepCounter = 0;

  const ensureRunCreated = async () => {
    if (runCreated) return;
    runCreated = true;
    await postToBridge('/api/runs', {
      id: runId,
      started_at: new Date().toISOString(),
    });
  };

  return {
    specificationVersion: 'v3',
    wrapGenerate: async ({doGenerate, params, model}) => {
      const startTime = Date.now();
      const stepId = crypto.randomUUID();
      await ensureRunCreated();
      await postToBridge('/api/steps', {
        id: stepId,
        run_id: runId,
        step_number: ++stepCounter,
        type: 'generate',
        model_id: model.modelId,
        provider: getModelProvider(model),
        started_at: new Date().toISOString(),
        input: getStepInput(params),
        provider_options: params.providerOptions
          ? stringify(params.providerOptions)
          : null,
      });

      try {
        const result = await doGenerate();
        await postToBridge(`/api/steps/${stepId}/result`, {
          duration_ms: Date.now() - startTime,
          output: stringify({
            content: result.content,
            finishReason: result.finishReason,
            response: result.response,
          }),
          usage: result.usage ? stringify(result.usage) : null,
          error: null,
          raw_request: result.request?.body
            ? stringify(result.request.body)
            : null,
          raw_response: result.response?.body
            ? stringify(result.response.body)
            : null,
          raw_chunks: null,
        });
        return result;
      } catch (error) {
        await postToBridge(`/api/steps/${stepId}/result`, {
          duration_ms: Date.now() - startTime,
          output: null,
          usage: null,
          error: error instanceof Error ? error.message : String(error),
          raw_request: null,
          raw_response: null,
          raw_chunks: null,
        });
        throw error;
      }
    },
    wrapStream: async ({doStream, params, model}) => {
      const startTime = Date.now();
      const stepId = crypto.randomUUID();
      await ensureRunCreated();

      const userRequestedRawChunks = params.includeRawChunks === true;
      params.includeRawChunks = true;

      await postToBridge('/api/steps', {
        id: stepId,
        run_id: runId,
        step_number: ++stepCounter,
        type: 'stream',
        model_id: model.modelId,
        provider: getModelProvider(model),
        started_at: new Date().toISOString(),
        input: getStepInput(params),
        provider_options: params.providerOptions
          ? stringify(params.providerOptions)
          : null,
      });

      try {
        const {stream, request, response, ...rest} = await doStream();
        const collectedOutput: {
          textParts: Array<{id: string; text: string}>;
          reasoningParts: Array<{id: string; text: string}>;
          toolCalls: StreamPart[];
          finishReason?: unknown;
          usage?: unknown;
        } = {
          textParts: [],
          reasoningParts: [],
          toolCalls: [],
        };
        const currentText = new Map<string, string>();
        const currentReasoning = new Map<string, string>();
        const fullStreamChunks: StreamPart[] = [];
        const rawChunks: unknown[] = [];

        const writeResult = async (error: string | null) => {
          await postToBridge(`/api/steps/${stepId}/result`, {
            duration_ms: Date.now() - startTime,
            output: stringify(collectedOutput),
            usage: collectedOutput.usage
              ? stringify(collectedOutput.usage)
              : null,
            error,
            raw_request: request?.body ? stringify(request.body) : null,
            raw_response: stringify(fullStreamChunks),
            raw_chunks: stringify(rawChunks),
          });
        };

        const transformer: Transformer<StreamPart, StreamPart> & {
          cancel?: () => Promise<void>;
        } = {
          transform(chunk, controller) {
            if (
              typeof chunk === 'object' &&
              chunk !== null &&
              'type' in chunk &&
              chunk.type === 'raw'
            ) {
              rawChunks.push((chunk as {rawValue?: unknown}).rawValue);
              if (userRequestedRawChunks) {
                controller.enqueue(chunk);
              }
              return;
            }

            fullStreamChunks.push(chunk);

            if (
              typeof chunk === 'object' &&
              chunk !== null &&
              'type' in chunk
            ) {
              switch (chunk.type) {
                case 'text-start':
                  currentText.set(String((chunk as {id: unknown}).id), '');
                  break;
                case 'text-delta': {
                  const id = String((chunk as {id: unknown}).id);
                  currentText.set(
                    id,
                    (currentText.get(id) ?? '') +
                      String((chunk as {delta: unknown}).delta ?? ''),
                  );
                  break;
                }
                case 'text-end': {
                  const id = String((chunk as {id: unknown}).id);
                  collectedOutput.textParts.push({
                    id,
                    text: currentText.get(id) ?? '',
                  });
                  break;
                }
                case 'reasoning-start':
                  currentReasoning.set(String((chunk as {id: unknown}).id), '');
                  break;
                case 'reasoning-delta': {
                  const id = String((chunk as {id: unknown}).id);
                  currentReasoning.set(
                    id,
                    (currentReasoning.get(id) ?? '') +
                      String((chunk as {delta: unknown}).delta ?? ''),
                  );
                  break;
                }
                case 'reasoning-end': {
                  const id = String((chunk as {id: unknown}).id);
                  collectedOutput.reasoningParts.push({
                    id,
                    text: currentReasoning.get(id) ?? '',
                  });
                  break;
                }
                case 'tool-call':
                  collectedOutput.toolCalls.push(chunk);
                  break;
                case 'finish':
                  collectedOutput.finishReason = (
                    chunk as {finishReason?: unknown}
                  ).finishReason;
                  collectedOutput.usage = (chunk as {usage?: unknown}).usage;
                  break;
              }
            }

            controller.enqueue(chunk);
          },
          async flush() {
            await writeResult(null);
          },
          async cancel() {
            await writeResult('Request aborted');
          },
        };

        const transformStream = new TransformStream<StreamPart, StreamPart>(
          transformer,
        );

        return {
          stream: stream.pipeThrough(transformStream),
          request,
          response,
          ...rest,
        };
      } catch (error) {
        await postToBridge(`/api/steps/${stepId}/result`, {
          duration_ms: Date.now() - startTime,
          output: null,
          usage: null,
          error: error instanceof Error ? error.message : String(error),
          raw_request: null,
          raw_response: null,
          raw_chunks: null,
        });
        throw error;
      }
    },
  };
}

export async function maybeWrapModelWithAiSdkDevTools(
  model: LanguageModel,
): Promise<LanguageModel> {
  if (!isAiSdkDevToolsEnabled()) {
    return model;
  }

  try {
    const middleware = isBrowserRuntime()
      ? getBrowserDevToolsMiddleware()
      : (
          (await import(
            /* @vite-ignore */ AI_SDK_DEVTOOLS_PACKAGE
          )) as DevToolsModule
        ).devToolsMiddleware();
    return wrapLanguageModel({
      model: model as WrappableLanguageModel,
      middleware,
    }) as LanguageModel;
  } catch (error) {
    console.warn('Failed to enable AI SDK DevTools middleware:', error);
    return model;
  }
}
