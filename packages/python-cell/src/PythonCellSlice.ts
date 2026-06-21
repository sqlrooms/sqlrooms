import {createId} from '@paralleldrive/cuid2';
import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {
  PythonCellResultSummary,
  PythonCellSliceConfig,
  PythonCellState,
  type PythonCellInput,
  type PythonCellOutputDeclaration,
  type PythonCellResultSummary as PythonCellResultSummaryType,
  type PythonCellSliceConfig as PythonCellSliceConfigType,
  type PythonCellState as PythonCellStateType,
  type PythonExecutionOutput,
  type PythonExecutionRequest,
  type PythonRuntimeAdapter,
  type PythonRuntimeCapability,
  type PythonRuntimeHost,
} from './types';

const DEFAULT_MAX_STDIO_BYTES = 32_000;
const DEFAULT_MAX_RICH_OUTPUT_BYTES = 512_000;

export type EnsurePythonCellOptions = Partial<
  Omit<PythonCellStateType, 'id' | 'updatedAt'>
>;

/** Runtime-only execution state for an active Python cell run. */
export type PythonCellRuntimeState = {
  status: 'running';
  executionId: string;
  startedAt: number;
};

/** Zustand slice state for durable Python cell blocks. */
export type PythonCellSliceState = {
  pythonCells: {
    config: PythonCellSliceConfigType;
    runtimeByCellId: Record<string, PythonCellRuntimeState | undefined>;
    setConfig(config: PythonCellSliceConfigType): void;
    ensureCell(
      cellId: string,
      options?: EnsurePythonCellOptions,
    ): PythonCellStateType;
    removeCell(cellId: string): void;
    renameCell(cellId: string, title: string): void;
    updateCellCode(cellId: string, code: string): void;
    patchCell(
      cellId: string,
      patch: Partial<
        Pick<
          PythonCellStateType,
          'inputs' | 'outputs' | 'requirements' | 'executionPolicy' | 'runtime'
        >
      >,
    ): void;
    clearCellResult(cellId: string): void;
    getCell(cellId: string): PythonCellStateType | undefined;
    runCell(
      cellId: string,
      options?: {artifactId?: string},
    ): Promise<PythonCellResultSummaryType>;
  };
};

/** Options for creating the Python cell slice. */
export type CreatePythonCellSliceOptions = {
  config?: PythonCellSliceConfigType;
  runtimeAdapter?: PythonRuntimeAdapter;
  host?: PythonRuntimeHost;
  limits?: PythonExecutionRequest['limits'];
};

/** Creates the Python cell slice. Runtime adapters stay outside persisted state. */
export function createPythonCellSlice({
  config = PythonCellSliceConfig.parse({}),
  runtimeAdapter,
  host = createUnavailablePythonRuntimeHost(),
  limits,
}: CreatePythonCellSliceOptions = {}) {
  return createSlice<
    PythonCellSliceState,
    BaseRoomStoreState & PythonCellSliceState
  >((set, get) => ({
    pythonCells: {
      config,
      runtimeByCellId: {},

      setConfig(nextConfig) {
        set((state) =>
          produce(state, (draft) => {
            draft.pythonCells.config = PythonCellSliceConfig.parse(nextConfig);
          }),
        );
      },

      ensureCell(cellId, options = {}) {
        const now = Date.now();
        const existing = get().pythonCells.config.cells[cellId];
        const nextCell = PythonCellState.parse({
          ...(existing ?? {}),
          id: cellId,
          title: options.title ?? existing?.title ?? 'Python Cell',
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
          updatedAt: now,
        });

        set((state) =>
          produce(state, (draft) => {
            draft.pythonCells.config.cells[cellId] = nextCell;
          }),
        );

        return nextCell;
      },

      removeCell(cellId) {
        set((state) =>
          produce(state, (draft) => {
            delete draft.pythonCells.config.cells[cellId];
            delete draft.pythonCells.runtimeByCellId[cellId];
          }),
        );
      },

      renameCell(cellId, title) {
        set((state) =>
          produce(state, (draft) => {
            const cell = draft.pythonCells.config.cells[cellId];
            if (!cell) return;
            cell.title = title || cell.title;
            cell.updatedAt = Date.now();
          }),
        );
      },

      updateCellCode(cellId, code) {
        get().pythonCells.ensureCell(cellId, {code});
      },

      patchCell(cellId, patch) {
        const existing = get().pythonCells.ensureCell(cellId);
        get().pythonCells.ensureCell(cellId, {
          ...existing,
          ...patch,
        });
      },

      clearCellResult(cellId) {
        set((state) =>
          produce(state, (draft) => {
            const cell = draft.pythonCells.config.cells[cellId];
            if (!cell) return;
            cell.lastResult = undefined;
            cell.updatedAt = Date.now();
          }),
        );
      },

      getCell(cellId) {
        return get().pythonCells.config.cells[cellId];
      },

      async runCell(cellId, options = {}) {
        const cell = get().pythonCells.ensureCell(cellId);
        const executionId = createId();
        const startedAt = Date.now();

        set((state) =>
          produce(state, (draft) => {
            draft.pythonCells.runtimeByCellId[cellId] = {
              status: 'running',
              executionId,
              startedAt,
            };
          }),
        );

        const request: PythonExecutionRequest = {
          executionId,
          blockId: cellId,
          artifactId: options.artifactId,
          code: cell.code,
          inputs: cell.inputs,
          grantedCapabilities: inferCapabilities(cell.inputs, cell.outputs),
          outputDeclarations: cell.outputs,
          requirements: cell.requirements,
          limits,
        };

        const result = runtimeAdapter
          ? await runWithAdapter(runtimeAdapter, request, host, startedAt)
          : createMissingAdapterResult(executionId, startedAt);

        set((state) =>
          produce(state, (draft) => {
            const currentRuntime = draft.pythonCells.runtimeByCellId[cellId];
            if (currentRuntime?.executionId !== executionId) return;
            const nextCell = draft.pythonCells.config.cells[cellId];
            if (nextCell) {
              nextCell.lastResult = result;
              nextCell.updatedAt = Date.now();
            }
            delete draft.pythonCells.runtimeByCellId[cellId];
          }),
        );

        return result;
      },
    },
  }));
}

function inferCapabilities(
  inputs: PythonCellInput[],
  outputs: PythonCellOutputDeclaration[],
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
): Promise<PythonCellResultSummaryType> {
  try {
    const result = await adapter.execute(request, host);
    const finishedAt = Date.now();
    return PythonCellResultSummary.parse({
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
    return PythonCellResultSummary.parse({
      executionId: request.executionId,
      status: 'error',
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      stdout: '',
      stderr: '',
      error: {
        name: error instanceof Error ? error.name : undefined,
        message:
          error instanceof Error ? error.message : 'Python execution failed.',
      },
      outputs: [],
    });
  }
}

function createMissingAdapterResult(
  executionId: string,
  startedAt: number,
): PythonCellResultSummaryType {
  const finishedAt = Date.now();
  return PythonCellResultSummary.parse({
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
        'No Python runtime adapter is configured. Add a Pyodide worker adapter before running Python cells.',
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
