import {createId} from '@paralleldrive/cuid2';
import {asSchema, type ToolSet} from 'ai';
import type {ProviderContextDiagnostic} from '../types';

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index) ?? 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else {
      bytes += 4;
      index += 1;
    }
  }
  return bytes;
}

function serializedByteLength(value: unknown): number {
  return utf8ByteLength(JSON.stringify(value) ?? 'null');
}

function textSize(value: unknown): {chars: number; bytes: number} {
  const serialized =
    typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
  return {
    chars: serialized.length,
    bytes: utf8ByteLength(serialized),
  };
}

export type MeasureProviderContextArgs = {
  role: string;
  provider: string;
  model: string;
  sessionId?: string;
  step: number;
  instructions: unknown;
  messages: unknown[];
  tools?: ToolSet;
  sources?: string[];
  preparationMetrics?: Record<string, number>;
};

/**
 * Measure the exact request assembly visible at the AI SDK's provider-step
 * boundary. The result intentionally contains sizes and identifiers only; it
 * never copies prompt, message, or schema content into diagnostics state.
 */
export async function measureProviderContext({
  role,
  provider,
  model,
  sessionId,
  step,
  instructions,
  messages,
  tools = {},
  sources = [],
  preparationMetrics,
}: MeasureProviderContextArgs): Promise<ProviderContextDiagnostic> {
  const toolEntries = await Promise.all(
    Object.entries(tools)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(async ([name, tool]) => {
        const inputSchema = await asSchema(tool.inputSchema).jsonSchema;
        const providerTool = {
          name,
          description: tool.description,
          inputSchema,
        };
        return {name, schemaBytes: serializedByteLength(providerTool)};
      }),
  );

  return {
    id: createId(),
    recordedAt: Date.now(),
    role,
    provider,
    model,
    ...(sessionId ? {sessionId} : {}),
    step,
    instructions: textSize(instructions),
    messages: {
      count: messages.length,
      bytes: serializedByteLength(messages),
    },
    tools: toolEntries,
    toolSchemaBytes: toolEntries.reduce(
      (total, entry) => total + entry.schemaBytes,
      0,
    ),
    sources: [...new Set(sources)].sort(),
    ...(preparationMetrics
      ? {preparationMetrics: {...preparationMetrics}}
      : {}),
  };
}
