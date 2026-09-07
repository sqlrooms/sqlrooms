import {DatabaseSync} from 'node:sqlite';
import {RunEvidenceSchema, type RunEvidence} from '../evidence.js';
import type {JsonObject, JsonValue} from '../json.js';
import {
  ObservatoryExportSchema,
  ObservatoryRunSchema,
  type ObservatoryExport,
  type ObservatoryRun,
} from './readModel.js';

type SqlRow = Record<string, unknown>;

const REQUIRED_COLUMNS = {
  evals: ['id', 'created_at', 'results', 'config'],
  eval_results: [
    'id',
    'eval_id',
    'created_at',
    'test_case',
    'prompt',
    'provider',
    'response',
    'error',
    'success',
    'score',
    'grading_result',
    'metadata',
  ],
} as const;

const OPTIONAL_TRACE_COLUMNS = {
  traces: ['trace_id', 'evaluation_id', 'test_case_id', 'metadata'],
  spans: [
    'trace_id',
    'span_id',
    'parent_span_id',
    'name',
    'start_time',
    'end_time',
    'attributes',
    'status_code',
    'status_message',
  ],
} as const;

/** Error raised when a retained database does not match the supported schema. */
export class UnsupportedPromptfooSchemaError extends Error {
  /**
   * Creates an error describing an unsupported Promptfoo schema detail.
   *
   * @param message - The missing table, column, or trace-storage requirement.
   */
  constructor(message: string) {
    super(`Unsupported Promptfoo SQLite schema: ${message}`);
    this.name = 'UnsupportedPromptfooSchemaError';
  }
}

function json(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function object(value: unknown): JsonObject {
  const parsed = json(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as JsonObject)
    : {};
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function timestamp(value: unknown): string {
  if (typeof value === 'number') {
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }
  const parsed = Date.parse(String(value));
  return new Date(Number.isNaN(parsed) ? 0 : parsed).toISOString();
}

function tableColumns(database: DatabaseSync, table: string): Set<string> {
  return new Set(
    (database.prepare(`PRAGMA table_info(${table})`).all() as SqlRow[])
      .map((row) => string(row.name))
      .filter((name): name is string => Boolean(name)),
  );
}

function assertColumns(
  database: DatabaseSync,
  table: string,
  required: readonly string[],
) {
  const columns = tableColumns(database, table);
  const missing = required.filter((column) => !columns.has(column));
  if (missing.length > 0) {
    throw new UnsupportedPromptfooSchemaError(
      `table ${table} is missing column(s): ${missing.join(', ')}. ` +
        `Available columns: ${[...columns].sort().join(', ') || '(none)'}.`,
    );
  }
}

function findEvidence(...values: unknown[]): RunEvidence | undefined {
  const candidates: unknown[] = [];
  for (const value of values) {
    const parsed = json(value);
    candidates.push(parsed);
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      candidates.push(record.sqlroomsEvidence);
      const metadata = object(record.metadata);
      candidates.push(metadata.sqlroomsEvidence);
    }
  }
  for (const candidate of candidates) {
    const result = RunEvidenceSchema.safeParse(candidate);
    if (result.success) return result.data;
  }
  return undefined;
}

function promptText(value: unknown): string {
  const parsed = json(value);
  if (typeof parsed === 'string') return parsed;
  const record = object(parsed);
  return string(record.raw) ?? string(record.label) ?? JSON.stringify(parsed);
}

function responseText(value: unknown): string {
  const parsed = json(value);
  if (typeof parsed === 'string') return parsed;
  const record = object(parsed);
  const output = record.output;
  return typeof output === 'string' ? output : JSON.stringify(output ?? '');
}

function inferScenario(testCase: JsonObject, metadata: JsonObject) {
  const vars = object(testCase.vars);
  return {
    id:
      string(vars.scenarioId) ??
      string(metadata.scenarioId) ??
      string(testCase.description) ??
      'unknown',
    version: number(metadata.scenarioVersion),
    repetition: number(metadata.repeatIndex),
  };
}

function spansByTrace(
  database: DatabaseSync,
): Map<string, ObservatoryRun['spans']> {
  const tables = new Set(
    (
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as SqlRow[]
    )
      .map((row) => string(row.name))
      .filter((name): name is string => Boolean(name)),
  );
  if (!tables.has('traces') && !tables.has('spans')) return new Map();
  if (!tables.has('traces') || !tables.has('spans')) {
    throw new UnsupportedPromptfooSchemaError(
      'trace storage must contain both traces and spans tables.',
    );
  }
  assertColumns(database, 'traces', OPTIONAL_TRACE_COLUMNS.traces);
  assertColumns(database, 'spans', OPTIONAL_TRACE_COLUMNS.spans);
  const rows = database
    .prepare(
      `SELECT s.* FROM traces t JOIN spans s ON s.trace_id = t.trace_id ORDER BY s.start_time`,
    )
    .all() as SqlRow[];
  const result = new Map<string, ObservatoryRun['spans']>();
  for (const row of rows) {
    const traceId = String(row.trace_id);
    const spans = result.get(traceId) ?? [];
    spans.push({
      traceId: String(row.trace_id),
      spanId: String(row.span_id),
      ...(string(row.parent_span_id)
        ? {parentSpanId: String(row.parent_span_id)}
        : {}),
      name: String(row.name),
      startTime: Number(row.start_time),
      ...(number(row.end_time) !== undefined
        ? {endTime: Number(row.end_time)}
        : {}),
      ...(number(row.status_code) !== undefined
        ? {statusCode: Number(row.status_code)}
        : {}),
      ...(string(row.status_message)
        ? {statusMessage: String(row.status_message)}
        : {}),
      attributes: object(row.attributes),
    });
    result.set(traceId, spans);
  }
  return result;
}

/**
 * Reads retained Promptfoo results into the normalized observatory run model.
 *
 * The database is opened through a strictly read-only connection and is never
 * migrated or otherwise modified.
 *
 * @param databasePath - Path to the retained Promptfoo SQLite database.
 * @returns Normalized runs ordered from newest to oldest.
 * @throws {@link UnsupportedPromptfooSchemaError} When required tables or
 * columns are missing, or trace storage is only partially present.
 */
export function readPromptfooSqlite(databasePath: string): ObservatoryRun[] {
  const database = new DatabaseSync(databasePath, {readOnly: true});
  try {
    const tables = new Set(
      (
        database
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all() as SqlRow[]
      )
        .map((row) => string(row.name))
        .filter((name): name is string => Boolean(name)),
    );
    for (const table of Object.keys(REQUIRED_COLUMNS)) {
      if (!tables.has(table)) {
        throw new UnsupportedPromptfooSchemaError(
          `required table ${table} was not found. Available tables: ${[
            ...tables,
          ]
            .sort()
            .join(', ')}.`,
        );
      }
      assertColumns(
        database,
        table,
        REQUIRED_COLUMNS[table as keyof typeof REQUIRED_COLUMNS],
      );
    }

    const traceSpans = spansByTrace(database);
    const rows = database
      .prepare(
        `SELECT r.*, e.created_at AS eval_created_at, e.results AS eval_results_json,
                e.config AS eval_config
           FROM eval_results r
           JOIN evals e ON e.id = r.eval_id
          ORDER BY r.created_at DESC`,
      )
      .all() as SqlRow[];

    return rows.map((row) => {
      const testCase = object(row.test_case);
      const metadata = object(row.metadata);
      const traceId = string(
        object(object(metadata.promptfoo).traceLinkage).traceId,
      );
      const response = object(row.response);
      const grading = json(row.grading_result) as JsonValue | undefined;
      const evidence = findEvidence(
        row.response,
        row.metadata,
        row.eval_results_json,
      );
      const provider = object(row.provider);
      const scenario = evidence?.scenario ?? inferScenario(testCase, metadata);
      const events = evidence?.events ?? [];
      const responseUsage = object(response.tokenUsage);
      const run: ObservatoryRun = {
        id: evidence?.runId ?? String(row.id),
        evalId: String(row.eval_id),
        createdAt: timestamp(row.created_at ?? row.eval_created_at),
        scenario,
        profile: evidence
          ? {
              name: evidence.target.profileName,
              version: evidence.target.profileVersion,
            }
          : {
              name: string(metadata.profile) ?? 'unknown',
            },
        repository: evidence?.repository
          ? {
              commitSha: evidence.repository.commitSha,
              ...(evidence.repository.workflowUrl
                ? {workflowUrl: evidence.repository.workflowUrl}
                : {}),
            }
          : {commitSha: string(metadata.commitSha)},
        model: evidence
          ? {
              provider: evidence.model.provider,
              modelId: evidence.model.modelId,
              ...(evidence.model.configuredRevision
                ? {revision: evidence.model.configuredRevision}
                : {}),
              ...(evidence.model.upstreamProvider
                ? {upstreamProvider: evidence.model.upstreamProvider}
                : {}),
            }
          : {
              provider:
                string(provider.id) ?? string(provider.label) ?? 'unknown',
              modelId:
                string(provider.label) ?? string(provider.id) ?? 'unknown',
            },
        status:
          evidence?.status ??
          (row.error ? 'error' : row.success ? 'passed' : 'failed'),
        score: number(row.score),
        latencyMs: evidence?.timing.latencyMs ?? number(row.latency_ms),
        usage:
          evidence?.usage ??
          (Object.keys(responseUsage).length > 0 ||
          number(row.cost) !== undefined
            ? {
                inputTokens: number(responseUsage.prompt),
                outputTokens: number(responseUsage.completion),
                totalTokens: number(responseUsage.total),
                costUsd: number(row.cost),
              }
            : undefined),
        counts: {
          tools: events.filter((event) => event.type === 'tool').length,
          nestedAgents: events.filter((event) => event.type === 'nested-agent')
            .length,
          errors:
            events.filter((event) => event.type === 'error').length +
            Number(Boolean(row.error)),
        },
        promptTurns: evidence?.promptTurns ?? [
          {id: 'promptfoo', input: promptText(row.prompt)},
        ],
        answer: evidence?.finalAnswer ?? responseText(row.response),
        checkResults: evidence?.checkResults ?? [],
        graderFeedback: grading,
        events,
        spans: traceId ? (traceSpans.get(traceId) ?? []) : [],
        finalState: evidence?.finalState,
        unknownMetadata: {
          evalConfig: json(row.eval_config) as JsonValue,
          evalMetadata: metadata,
          testCase,
          providerResponseMetadata: object(response.metadata),
        },
      };
      return ObservatoryRunSchema.parse(run);
    });
  } finally {
    database.close();
  }
}

/**
 * Creates a portable observatory export from a retained Promptfoo database.
 *
 * The source database is read through {@link readPromptfooSqlite} and is never
 * modified.
 *
 * @param databasePath - Path to the retained Promptfoo SQLite database.
 * @param now - Timestamp to record as the export time.
 * @returns A validated, portable observatory export.
 * @throws {@link UnsupportedPromptfooSchemaError} When the database uses an
 * unsupported Promptfoo schema.
 */
export function exportPromptfooSqlite(
  databasePath: string,
  now: Date = new Date(),
): ObservatoryExport {
  return ObservatoryExportSchema.parse({
    schemaVersion: 1,
    exportedAt: now.toISOString(),
    source: {kind: 'promptfoo-sqlite', label: databasePath},
    runs: readPromptfooSqlite(databasePath),
    unknownMetadata: {},
  });
}
