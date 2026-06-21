import {z} from 'zod';

/** Runtime adapter families supported by Python cell state. */
export const PythonRuntimeAdapterKind = z.enum([
  'pyodide',
  'sidecar',
  'remote',
]);
export type PythonRuntimeAdapterKind = z.infer<typeof PythonRuntimeAdapterKind>;

/** Execution status persisted in bounded Python cell result summaries. */
export const PythonExecutionStatus = z.enum([
  'idle',
  'running',
  'success',
  'error',
  'interrupted',
]);
export type PythonExecutionStatus = z.infer<typeof PythonExecutionStatus>;

/** Declared input made available to a Python cell execution. */
export const PythonCellInput = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('tableRef'),
    name: z.string(),
    tableName: z.string(),
    maxRows: z.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal('sql'),
    name: z.string(),
    query: z.string(),
    maxRows: z.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal('schema'),
    name: z.string(),
    tableName: z.string().optional(),
  }),
  z.object({
    kind: z.literal('literal'),
    name: z.string(),
    value: z.unknown(),
  }),
]);
export type PythonCellInput = z.infer<typeof PythonCellInput>;

/** Declared output a Python cell may write back into SQLRooms. */
export const PythonCellOutputDeclaration = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    name: z.string(),
  }),
  z.object({
    type: z.literal('json'),
    name: z.string(),
  }),
  z.object({
    type: z.literal('table'),
    name: z.string(),
    tableName: z.string().optional(),
  }),
  z.object({
    type: z.literal('image'),
    name: z.string(),
    mimeType: z.string().optional(),
  }),
  z.object({
    type: z.literal('markdown'),
    name: z.string(),
  }),
]);
export type PythonCellOutputDeclaration = z.infer<
  typeof PythonCellOutputDeclaration
>;

/** Package requirement requested by a Python cell. */
export const PythonRequirementSpec = z.object({
  name: z.string(),
  version: z.string().optional(),
  source: z.enum(['pyodide', 'micropip', 'host']).optional(),
});
export type PythonRequirementSpec = z.infer<typeof PythonRequirementSpec>;

/** Bounded persisted execution policy for a Python cell. */
export const PythonCellExecutionPolicy = z
  .object({
    autorun: z.literal(false).optional(),
    runOnInputChange: z.literal(false).optional(),
  })
  .default({});
export type PythonCellExecutionPolicy = z.infer<
  typeof PythonCellExecutionPolicy
>;

/** Runtime preference stored with a Python cell without naming Pyodide as state. */
export const PythonCellRuntimeSpec = z.object({
  kind: z.literal('python').default('python'),
  preferredAdapter: PythonRuntimeAdapterKind.optional(),
});
export type PythonCellRuntimeSpec = z.infer<typeof PythonCellRuntimeSpec>;

/** Portable output handle returned by Python execution. */
export const PythonExecutionOutput = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('json'),
    name: z.string(),
    value: z.unknown(),
    preview: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('text'),
    name: z.string(),
    text: z.string(),
  }),
  z.object({
    type: z.literal('table'),
    name: z.string(),
    tableName: z.string(),
    rowCount: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('image'),
    name: z.string(),
    assetId: z.string(),
    mimeType: z.string(),
  }),
  z.object({
    type: z.literal('markdown'),
    name: z.string(),
    markdown: z.string(),
  }),
]);
export type PythonExecutionOutput = z.infer<typeof PythonExecutionOutput>;

/** Bounded error summary safe to persist in room state. */
export const PythonExecutionError = z.object({
  name: z.string().optional(),
  message: z.string(),
  traceback: z.string().optional(),
});
export type PythonExecutionError = z.infer<typeof PythonExecutionError>;

/** Bounded result summary persisted in Python cell state. */
export const PythonCellResultSummary = z.object({
  executionId: z.string(),
  status: PythonExecutionStatus.exclude(['idle', 'running']),
  startedAt: z.number().optional(),
  finishedAt: z.number().optional(),
  durationMs: z.number().nonnegative().optional(),
  stdout: z.string().default(''),
  stderr: z.string().default(''),
  error: PythonExecutionError.optional(),
  outputs: z.array(PythonExecutionOutput).default([]),
});
export type PythonCellResultSummary = z.infer<typeof PythonCellResultSummary>;

/** Durable Python cell state stored in SQLRooms room config. */
export const PythonCellState = z.object({
  id: z.string(),
  title: z.string().default('Python Cell'),
  code: z.string().default(''),
  runtime: PythonCellRuntimeSpec.default({kind: 'python'}),
  inputs: z.array(PythonCellInput).default([]),
  outputs: z.array(PythonCellOutputDeclaration).default([]),
  requirements: z.array(PythonRequirementSpec).default([]),
  executionPolicy: PythonCellExecutionPolicy,
  lastResult: PythonCellResultSummary.optional(),
  updatedAt: z.number().default(0),
});
export type PythonCellState = z.infer<typeof PythonCellState>;

/** Persisted slice config for Python cells. */
export const PythonCellSliceConfig = z.object({
  cells: z.record(z.string(), PythonCellState).default({}),
});
export type PythonCellSliceConfig = z.infer<typeof PythonCellSliceConfig>;

/** Request passed from SQLRooms to a Python runtime adapter. */
export type PythonExecutionRequest = {
  executionId: string;
  blockId: string;
  artifactId?: string;
  code: string;
  inputs: PythonCellInput[];
  grantedCapabilities: PythonRuntimeCapability[];
  outputDeclarations: PythonCellOutputDeclaration[];
  requirements?: PythonRequirementSpec[];
  limits?: {
    timeoutMs?: number;
    maxStdoutBytes?: number;
    maxRowsPreview?: number;
  };
};

/** Result returned by a Python runtime adapter. */
export type PythonExecutionResult = {
  executionId: string;
  status: 'success' | 'error' | 'interrupted';
  stdout: string;
  stderr: string;
  error?: PythonExecutionError;
  outputs: PythonExecutionOutput[];
  durationMs: number;
};

/** Narrow host capability granted to Python execution. */
export type PythonRuntimeCapability =
  | 'query'
  | 'schema'
  | 'tableOutput'
  | 'assetOutput'
  | 'network';

/** Tabular input payload supplied to a runtime adapter. */
export type PythonTabularInput = {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount?: number;
};

/** Tabular output payload returned by a runtime adapter for host materialization. */
export type PythonTabularOutput = PythonTabularInput;

/** Read-only SQL request mediated by the SQLRooms host. */
export type ReadonlySqlRequest = {
  query: string;
  maxRows?: number;
};

/** Schema request mediated by the SQLRooms host. */
export type PythonSchemaRequest = {
  tableName?: string;
};

/** Bounded schema summary returned by the SQLRooms host. */
export type PythonSchemaSummary = {
  tables: Array<{
    tableName: string;
    columns: Array<{name: string; type?: string}>;
  }>;
};

/** Table input spec resolved by the SQLRooms host. */
export type PythonTableInputSpec = Extract<PythonCellInput, {kind: 'tableRef'}>;

/** Table output spec resolved by the SQLRooms host. */
export type PythonTableOutputSpec = Extract<
  PythonCellOutputDeclaration,
  {type: 'table'}
>;

/** Asset output payload the host may persist as a document/block asset. */
export type PythonAssetOutput = {
  name: string;
  mimeType: string;
  data: ArrayBuffer | string;
};

/** Resolved package descriptor returned by the SQLRooms host. */
export type PythonResolvedPackageSpec = PythonRequirementSpec & {
  url?: string;
};

/** Host bridge exposed to runtime adapters instead of room-store internals. */
export type PythonRuntimeHost = {
  readTable(input: PythonTableInputSpec): Promise<PythonTabularInput>;
  runReadonlySql?(request: ReadonlySqlRequest): Promise<PythonTabularInput>;
  readSchema?(request: PythonSchemaRequest): Promise<PythonSchemaSummary>;
  writeTable?(
    output: PythonTableOutputSpec,
    data: PythonTabularOutput,
  ): Promise<{tableName: string; rowCount?: number}>;
  writeAsset?(asset: PythonAssetOutput): Promise<{assetId: string}>;
  resolvePackages?(
    requirements: PythonRequirementSpec[],
  ): Promise<PythonResolvedPackageSpec[]>;
};

/** Runtime adapter for browser-local or external Python execution. */
export type PythonRuntimeAdapter = {
  id: PythonRuntimeAdapterKind;
  status(): Promise<{
    state: 'idle' | 'loading' | 'ready' | 'error';
    message?: string;
  }>;
  execute(
    request: PythonExecutionRequest,
    host: PythonRuntimeHost,
  ): Promise<PythonExecutionResult>;
  interrupt?(executionId: string): Promise<void>;
  reset?(sessionId: string): Promise<void>;
  dispose?(): Promise<void>;
};
