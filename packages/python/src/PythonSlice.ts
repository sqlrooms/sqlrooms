import {createId} from '@paralleldrive/cuid2';
import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {
  PythonResultSummary,
  PythonSliceConfig,
  PythonBlockState,
  type PythonInput,
  type PythonOutputDeclaration,
  type PythonResultSummary as PythonResultSummaryType,
  type PythonSliceConfig as PythonSliceConfigType,
  type PythonBlockState as PythonBlockStateType,
  type PythonExecutionOutput,
  type PythonExecutionRequest,
  type PythonRuntimeAdapter,
  type PythonRuntimeCapability,
  type PythonRuntimeHost,
} from './types';

const DEFAULT_MAX_STDIO_BYTES = 32_000;
const DEFAULT_MAX_RICH_OUTPUT_BYTES = 512_000;

export type EnsurePythonBlockOptions = Partial<
  Omit<PythonBlockStateType, 'id' | 'updatedAt'>
>;

/** Runtime-only execution state for an active Python block run. */
export type PythonBlockRuntimeState = {
  status: 'running';
  executionId: string;
  startedAt: number;
};

/** Zustand slice state for durable Python blocks. */
export type PythonSliceState = {
  python: {
    config: PythonSliceConfigType;
    runtimeByBlockId: Record<string, PythonBlockRuntimeState | undefined>;
    setConfig(config: PythonSliceConfigType): void;
    ensureBlock(
      blockId: string,
      options?: EnsurePythonBlockOptions,
    ): PythonBlockStateType;
    removeBlock(blockId: string): void;
    renameBlock(blockId: string, title: string): void;
    updateBlockCode(blockId: string, code: string): void;
    patchBlock(
      blockId: string,
      patch: Partial<
        Pick<
          PythonBlockStateType,
          'inputs' | 'outputs' | 'requirements' | 'executionPolicy' | 'runtime'
        >
      >,
    ): void;
    clearBlockResult(blockId: string): void;
    getBlock(blockId: string): PythonBlockStateType | undefined;
    runBlock(
      blockId: string,
      options?: {artifactId?: string},
    ): Promise<PythonResultSummaryType>;
  };
};

/** Options for creating the Python slice. */
export type CreatePythonSliceOptions = {
  config?: PythonSliceConfigType;
  runtimeAdapter?: PythonRuntimeAdapter;
  host?: PythonRuntimeHost;
  limits?: PythonExecutionRequest['limits'];
};

/** Creates the Python slice. Runtime adapters stay outside persisted state. */
export function createPythonSlice({
  config = PythonSliceConfig.parse({}),
  runtimeAdapter,
  host = createUnavailablePythonRuntimeHost(),
  limits,
}: CreatePythonSliceOptions = {}) {
  return createSlice<PythonSliceState, BaseRoomStoreState & PythonSliceState>(
    (set, get) => ({
      python: {
        config,
        runtimeByBlockId: {},

        setConfig(nextConfig) {
          set((state) =>
            produce(state, (draft) => {
              draft.python.config = PythonSliceConfig.parse(nextConfig);
            }),
          );
        },

        ensureBlock(blockId, options = {}) {
          const now = Date.now();
          const existing = get().python.config.blocks[blockId];
          const candidateBlock = PythonBlockState.parse({
            ...(existing ?? {}),
            id: blockId,
            title: options.title ?? existing?.title ?? 'Python',
            code: options.code ?? existing?.code ?? '',
            runtime: options.runtime ?? existing?.runtime ?? {kind: 'python'},
            inputs: options.inputs ?? existing?.inputs ?? [],
            outputs: options.outputs ?? existing?.outputs ?? [],
            requirements: options.requirements ?? existing?.requirements ?? [],
            executionPolicy:
              options.executionPolicy ?? existing?.executionPolicy ?? {},
            lastResult:
              options.lastResult === undefined
                ? existing?.lastResult
                : options.lastResult,
            updatedAt: existing?.updatedAt ?? now,
          });
          if (existing && arePythonBlocksEqual(existing, candidateBlock)) {
            return existing;
          }
          const nextBlock = {
            ...candidateBlock,
            updatedAt: now,
          };

          set((state) =>
            produce(state, (draft) => {
              draft.python.config.blocks[blockId] = nextBlock;
            }),
          );

          return nextBlock;
        },

        removeBlock(blockId) {
          set((state) =>
            produce(state, (draft) => {
              delete draft.python.config.blocks[blockId];
              delete draft.python.runtimeByBlockId[blockId];
            }),
          );
        },

        renameBlock(blockId, title) {
          set((state) =>
            produce(state, (draft) => {
              const block = draft.python.config.blocks[blockId];
              if (!block) return;
              block.title = title || block.title;
              block.updatedAt = Date.now();
            }),
          );
        },

        updateBlockCode(blockId, code) {
          get().python.ensureBlock(blockId, {code});
        },

        patchBlock(blockId, patch) {
          const existing = get().python.config.blocks[blockId];
          get().python.ensureBlock(blockId, {
            ...(existing ?? {}),
            ...patch,
          });
        },

        clearBlockResult(blockId) {
          set((state) =>
            produce(state, (draft) => {
              const block = draft.python.config.blocks[blockId];
              if (!block) return;
              block.lastResult = undefined;
              block.updatedAt = Date.now();
            }),
          );
        },

        getBlock(blockId) {
          return get().python.config.blocks[blockId];
        },

        async runBlock(blockId, options = {}) {
          const block = get().python.ensureBlock(blockId);
          const executionId = createId();
          const startedAt = Date.now();

          set((state) =>
            produce(state, (draft) => {
              draft.python.runtimeByBlockId[blockId] = {
                status: 'running',
                executionId,
                startedAt,
              };
            }),
          );

          const request: PythonExecutionRequest = {
            executionId,
            blockId,
            artifactId: options.artifactId,
            code: block.code,
            inputs: block.inputs,
            grantedCapabilities: inferCapabilities(block.inputs, block.outputs),
            outputDeclarations: block.outputs,
            requirements: block.requirements,
            limits,
          };

          const result = runtimeAdapter
            ? await runWithAdapter(runtimeAdapter, request, host, startedAt)
            : createMissingAdapterResult(executionId, startedAt);

          set((state) =>
            produce(state, (draft) => {
              const currentRuntime = draft.python.runtimeByBlockId[blockId];
              if (currentRuntime?.executionId !== executionId) return;
              const nextBlock = draft.python.config.blocks[blockId];
              if (nextBlock) {
                nextBlock.lastResult = result;
                nextBlock.updatedAt = Date.now();
              }
              delete draft.python.runtimeByBlockId[blockId];
            }),
          );

          return result;
        },
      },
    }),
  );
}

function arePythonBlocksEqual(
  left: PythonBlockStateType,
  right: PythonBlockStateType,
) {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.code === right.code &&
    jsonEqual(left.runtime, right.runtime) &&
    jsonEqual(left.inputs, right.inputs) &&
    jsonEqual(left.outputs, right.outputs) &&
    jsonEqual(left.requirements, right.requirements) &&
    jsonEqual(left.executionPolicy, right.executionPolicy) &&
    jsonEqual(left.lastResult, right.lastResult)
  );
}

function jsonEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function inferCapabilities(
  inputs: PythonInput[],
  outputs: PythonOutputDeclaration[],
): PythonRuntimeCapability[] {
  const capabilities = new Set<PythonRuntimeCapability>();
  if (
    inputs.some((input) => input.kind === 'sql' || input.kind === 'tableRef')
  ) {
    capabilities.add('query');
  }
  if (inputs.some((input) => input.kind === 'schema')) {
    capabilities.add('schema');
  }
  if (outputs.some((output) => output.type === 'table')) {
    capabilities.add('tableOutput');
  }
  if (outputs.some((output) => output.type === 'image')) {
    capabilities.add('assetOutput');
  }
  return [...capabilities];
}

async function runWithAdapter(
  adapter: PythonRuntimeAdapter,
  request: PythonExecutionRequest,
  host: PythonRuntimeHost,
  startedAt: number,
): Promise<PythonResultSummaryType> {
  try {
    const result = await adapter.execute(request, host);
    const finishedAt = Date.now();
    return PythonResultSummary.parse({
      executionId: result.executionId,
      status: result.status,
      startedAt,
      finishedAt,
      durationMs: result.durationMs,
      stdout: truncate(result.stdout, DEFAULT_MAX_STDIO_BYTES),
      stderr: truncate(result.stderr, DEFAULT_MAX_STDIO_BYTES),
      error: result.error
        ? {
            ...result.error,
            name: result.error.name
              ? truncate(result.error.name, DEFAULT_MAX_STDIO_BYTES)
              : undefined,
            message: truncate(result.error.message, DEFAULT_MAX_STDIO_BYTES),
            traceback: truncate(
              result.error.traceback,
              DEFAULT_MAX_STDIO_BYTES,
            ),
          }
        : undefined,
      outputs: result.outputs.map(boundOutput),
    });
  } catch (error) {
    const finishedAt = Date.now();
    return PythonResultSummary.parse({
      executionId: request.executionId,
      status: 'error',
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      stdout: '',
      stderr: '',
      error: {
        name:
          error instanceof Error
            ? truncate(error.name, DEFAULT_MAX_STDIO_BYTES)
            : undefined,
        message: truncate(
          error instanceof Error ? error.message : 'Python execution failed.',
          DEFAULT_MAX_STDIO_BYTES,
        ),
      },
      outputs: [],
    });
  }
}

function createMissingAdapterResult(
  executionId: string,
  startedAt: number,
): PythonResultSummaryType {
  const finishedAt = Date.now();
  return PythonResultSummary.parse({
    executionId,
    status: 'error',
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    stdout: '',
    stderr: '',
    error: {
      name: 'PythonRuntimeUnavailable',
      message:
        'No Python runtime adapter is configured. Add a Pyodide worker adapter before running Python blocks.',
    },
    outputs: [],
  });
}

function createUnavailablePythonRuntimeHost(): PythonRuntimeHost {
  const unavailable = async () => {
    throw new Error('No Python runtime host capability is configured.');
  };
  return {
    readTable: unavailable,
  };
}

function boundOutput(output: PythonExecutionOutput): PythonExecutionOutput {
  if (output.type === 'text') {
    return {
      ...output,
      text: truncate(output.text, DEFAULT_MAX_STDIO_BYTES),
    };
  }
  if (output.type === 'markdown') {
    return {
      ...output,
      markdown: truncate(output.markdown, DEFAULT_MAX_STDIO_BYTES),
    };
  }
  if (output.type === 'html') {
    return {
      ...output,
      html: truncate(output.html, DEFAULT_MAX_RICH_OUTPUT_BYTES),
    };
  }
  if (output.type === 'vega-lite') {
    const boundedSpec = boundJson(output.spec, DEFAULT_MAX_RICH_OUTPUT_BYTES);
    if (boundedSpec !== undefined) {
      return {
        ...output,
        spec: boundedSpec,
      };
    }
    return {
      type: 'text',
      name: output.name,
      text: 'Vega-Lite output exceeded the persisted output size limit.',
    };
  }
  if (output.type === 'json') {
    if (isJsonWithinLimit(output.value, DEFAULT_MAX_RICH_OUTPUT_BYTES)) {
      return output;
    }
    return {
      type: 'text',
      name: output.name,
      text: 'JSON output exceeded the persisted output size limit.',
    };
  }
  return output;
}

function truncate(value: string | undefined, maxBytes: number) {
  if (!value) return '';
  const encoder = new TextEncoder();
  if (encoder.encode(value).byteLength <= maxBytes) return value;

  const suffix = '\n... truncated ...';
  const suffixBytes = encoder.encode(suffix).byteLength;
  const maxContentBytes = Math.max(0, maxBytes - suffixBytes);
  let result = '';
  let resultBytes = 0;
  for (const character of value) {
    const characterBytes = encoder.encode(character).byteLength;
    if (resultBytes + characterBytes > maxContentBytes) break;
    result += character;
    resultBytes += characterBytes;
  }
  return result + suffix;
}

function boundJson<T extends Record<string, unknown>>(
  value: T,
  maxBytes: number,
) {
  const json = JSON.stringify(value);
  if (new TextEncoder().encode(json).byteLength > maxBytes) return undefined;
  return value;
}

function isJsonWithinLimit(value: unknown, maxBytes: number) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength <= maxBytes;
}
