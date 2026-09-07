import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import type {JsonObject} from './json.js';

/** One text or tool-call output emitted by a scripted model step. */
export type ScriptedModelContent =
  | {type: 'text'; text: string}
  | {
      type: 'tool-call';
      toolName: string;
      input: JsonObject;
      toolCallId?: string;
    };

/** Declarative checks for the AI SDK call that consumes a scripted step. */
export type ScriptedModelExpectation = {
  promptIncludes?: readonly string[];
  availableToolNames?: readonly string[];
};

/** One deterministic response in a scripted AI SDK model. */
export type ScriptedModelStep = {
  content: readonly ScriptedModelContent[];
  finishReason?: LanguageModelV3FinishReason['unified'];
  expectation?: ScriptedModelExpectation;
  usage?: Partial<{
    inputTokens: number;
    outputTokens: number;
  }>;
};

/** Handle returned with a scripted language model and its observed calls. */
export type ScriptedLanguageModel = {
  model: LanguageModelV3;
  calls: LanguageModelV3CallOptions[];
  remainingSteps(): number;
  assertComplete(): void;
};

function promptText(options: LanguageModelV3CallOptions): string {
  return options.prompt
    .flatMap((message) =>
      typeof message.content === 'string'
        ? [message.content]
        : message.content.flatMap((part) =>
            part.type === 'text' || part.type === 'reasoning'
              ? [part.text]
              : [],
          ),
    )
    .join('\n');
}

function validateExpectation(
  expectation: ScriptedModelExpectation | undefined,
  options: LanguageModelV3CallOptions,
) {
  if (!expectation) return;
  const text = promptText(options);
  for (const expectedText of expectation.promptIncludes ?? []) {
    if (!text.includes(expectedText)) {
      throw new Error(
        `Scripted model expected prompt to include ${JSON.stringify(expectedText)}.`,
      );
    }
  }

  if (expectation.availableToolNames) {
    const actualNames = (options.tools ?? []).map((tool) => tool.name).sort();
    const expectedNames = [...expectation.availableToolNames].sort();
    if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
      throw new Error(
        `Scripted model expected tools ${expectedNames.join(', ') || '(none)'}, received ${actualNames.join(', ') || '(none)'}.`,
      );
    }
  }
}

function usage(step: ScriptedModelStep): LanguageModelV3Usage {
  const inputTokens = step.usage?.inputTokens ?? 0;
  const outputTokens = step.usage?.outputTokens ?? 0;
  return {
    inputTokens: {
      total: inputTokens,
      noCache: inputTokens,
      cacheRead: 0,
      cacheWrite: 0,
    },
    outputTokens: {
      total: outputTokens,
      text: outputTokens,
      reasoning: 0,
    },
  };
}

function finishReason(step: ScriptedModelStep): LanguageModelV3FinishReason {
  const unified =
    step.finishReason ??
    (step.content.some((content) => content.type === 'tool-call')
      ? 'tool-calls'
      : 'stop');
  return {unified, raw: unified};
}

function content(
  step: ScriptedModelStep,
  stepIndex: number,
): LanguageModelV3Content[] {
  return step.content.map((part, partIndex) =>
    part.type === 'text'
      ? part
      : {
          type: 'tool-call' as const,
          toolCallId: part.toolCallId ?? `scripted-${stepIndex}-${partIndex}`,
          toolName: part.toolName,
          input: JSON.stringify(part.input),
        },
  );
}

function streamParts(
  generated: LanguageModelV3GenerateResult,
): LanguageModelV3StreamPart[] {
  const parts: LanguageModelV3StreamPart[] = [
    {type: 'stream-start', warnings: []},
  ];
  generated.content.forEach((part, index) => {
    if (part.type === 'text') {
      const id = `text-${index}`;
      parts.push(
        {type: 'text-start', id},
        {type: 'text-delta', id, delta: part.text},
        {type: 'text-end', id},
      );
    } else if (part.type === 'tool-call') {
      parts.push(part);
    }
  });
  parts.push({
    type: 'finish',
    usage: generated.usage,
    finishReason: generated.finishReason,
  });
  return parts;
}

/** Creates a network-free AI SDK v3 language model from ordered responses. */
export function createScriptedLanguageModel({
  steps,
  provider = 'sqlrooms-scripted',
  modelId = 'scripted-v1',
}: {
  steps: readonly ScriptedModelStep[];
  provider?: string;
  modelId?: string;
}): ScriptedLanguageModel {
  const queue = [...steps];
  const calls: LanguageModelV3CallOptions[] = [];
  let stepIndex = 0;

  const generate = (
    options: LanguageModelV3CallOptions,
  ): LanguageModelV3GenerateResult => {
    const step = queue.shift();
    if (!step) {
      throw new Error('Scripted model received more calls than configured.');
    }
    calls.push(options);
    validateExpectation(step.expectation, options);
    const result: LanguageModelV3GenerateResult = {
      content: content(step, stepIndex),
      finishReason: finishReason(step),
      usage: usage(step),
      warnings: [],
      response: {modelId},
    };
    stepIndex += 1;
    return result;
  };

  const model: LanguageModelV3 = {
    specificationVersion: 'v3',
    provider,
    modelId,
    supportedUrls: {},
    doGenerate: async (options) => generate(options),
    doStream: async (options) => {
      const generated = generate(options);
      return {
        stream: new ReadableStream<LanguageModelV3StreamPart>({
          start(controller) {
            for (const part of streamParts(generated)) controller.enqueue(part);
            controller.close();
          },
        }),
      };
    },
  };

  return {
    model,
    calls,
    remainingSteps: () => queue.length,
    assertComplete: () => {
      if (queue.length > 0) {
        throw new Error(
          `Scripted model has ${queue.length} unconsumed step${queue.length === 1 ? '' : 's'}.`,
        );
      }
    },
  };
}
