import {afterEach, describe, expect, it} from '@jest/globals';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {RUN_EVIDENCE_SCHEMA_VERSION, type RunEvidence} from '../evidence';
import {
  UnsupportedPromptfooSchemaError,
  compareObservatoryRuns,
  computeCalibrationRates,
  exportPromptfooSqlite,
  filterObservatoryRuns,
  findAutomaticBaseline,
  readPromptfooSqlite,
  renderObservatoryMarkdown,
  summarizeObservatoryRuns,
} from '../promptfoo';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, {recursive: true, force: true});
  }
});

function fixtureDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'sqlrooms-evals-'));
  directories.push(directory);
  const path = join(directory, 'promptfoo.db');
  const database = new DatabaseSync(path);
  database.exec(`
    CREATE TABLE evals (
      id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, results TEXT NOT NULL,
      config TEXT NOT NULL
    );
    CREATE TABLE eval_results (
      id TEXT PRIMARY KEY, eval_id TEXT NOT NULL, created_at INTEGER NOT NULL,
      test_case TEXT NOT NULL, prompt TEXT NOT NULL, provider TEXT NOT NULL,
      latency_ms INTEGER, cost REAL, response TEXT, error TEXT,
      success INTEGER NOT NULL, score REAL NOT NULL, grading_result TEXT,
      metadata TEXT
    );
    CREATE TABLE traces (
      id TEXT PRIMARY KEY, trace_id TEXT NOT NULL, evaluation_id TEXT NOT NULL,
      test_case_id TEXT NOT NULL, metadata TEXT
    );
    CREATE TABLE spans (
      id TEXT PRIMARY KEY, trace_id TEXT NOT NULL, span_id TEXT NOT NULL,
      parent_span_id TEXT, name TEXT NOT NULL, start_time INTEGER NOT NULL,
      end_time INTEGER, attributes TEXT, status_code INTEGER,
      status_message TEXT
    );
  `);
  return {database, path};
}

function evidence(status: 'passed' | 'failed'): RunEvidence {
  return {
    schemaVersion: RUN_EVIDENCE_SCHEMA_VERSION,
    runId: `run-${status}`,
    scenario: {id: 'document.create-chart-map', version: 1, repetition: 0},
    target: {
      type: 'cli-in-process',
      profileName: 'document-charts-maps',
      profileVersion: 1,
    },
    repository: {commitSha: 'abc123', dirty: false},
    model: {
      provider: 'openrouter',
      modelId: 'deepseek/deepseek-v4-flash-0731',
      configuredRevision: 'deepseek/deepseek-v4-flash-0731',
      settings: {temperature: 0, maxSteps: 24},
    },
    timing: {
      startedAt: '2026-08-19T12:00:00.000Z',
      endedAt: '2026-08-19T12:00:01.000Z',
      latencyMs: status === 'passed' ? 1000 : 1200,
    },
    status,
    promptTurns: [{id: 'create', input: 'Create a document.'}],
    finalAnswer: 'Created a chart and map from analytics.events.',
    events: [
      {
        sequence: 0,
        timestamp: '2026-08-19T12:00:00.500Z',
        type: 'nested-agent',
        name: 'block_document_agent',
        data: {},
      },
      {
        sequence: 1,
        timestamp: '2026-08-19T12:00:00.600Z',
        type: 'tool',
        name: 'create_chart',
        data: {},
      },
    ],
    usage: {inputTokens: 100, outputTokens: 20, totalTokens: 120},
    finalState: {documents: [{id: 'document-1'}]},
    checkResults: [
      {
        checkId: 'workspace-shape',
        kind: 'workspace-state',
        pass: status === 'passed',
        score: status === 'passed' ? 1 : 0,
        reason: status === 'passed' ? 'Valid.' : 'Missing map.',
        evidence: {},
        metadata: {},
      },
    ],
    metadata: {},
  };
}

function insertRun(
  database: DatabaseSync,
  runEvidence: RunEvidence,
  id: string,
  traceId = `trace-${id}`,
) {
  database
    .prepare('INSERT OR IGNORE INTO evals VALUES (?, ?, ?, ?)')
    .run('eval-1', 1_776_254_400_000, '{}', '{"futureConfig":true}');
  database
    .prepare(
      `INSERT INTO eval_results
       (id, eval_id, created_at, test_case, prompt, provider, latency_ms, cost,
        response, error, success, score, grading_result, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      'eval-1',
      1_776_254_400_000,
      '{"vars":{"scenarioId":"document.create-chart-map"}}',
      '{"raw":"Create a document."}',
      '{"id":"openrouter","label":"deepseek"}',
      runEvidence.timing.latencyMs,
      0.002,
      JSON.stringify({
        output: runEvidence.finalAnswer,
        metadata: {sqlroomsEvidence: runEvidence, futureResponse: 42},
      }),
      null,
      runEvidence.status === 'passed' ? 1 : 0,
      runEvidence.status === 'passed' ? 1 : 0,
      '{"reason":"deterministic checks"}',
      JSON.stringify({
        futureResult: 'preserved',
        promptfoo: {traceLinkage: {traceId}},
      }),
    );
  database
    .prepare('INSERT INTO traces VALUES (?, ?, ?, ?, ?)')
    .run(`${id}-trace-row`, traceId, 'eval-1', id, '{"futureTrace":true}');
  database
    .prepare('INSERT INTO spans VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(
      `${id}-span-row`,
      traceId,
      `${id}-span-1`,
      null,
      'agent',
      100,
      200,
      '{"role":"coordinator"}',
      1,
      null,
    );
}

function snapshotSqliteFiles(path: string): Record<string, string> {
  const directory = dirname(path);
  const filename = basename(path);
  return Object.fromEntries(
    readdirSync(directory)
      .filter((entry) => entry === filename || entry.startsWith(`${filename}-`))
      .sort()
      .map((entry) => [
        entry,
        createHash('sha256')
          .update(readFileSync(join(directory, entry)))
          .digest('hex'),
      ]),
  );
}

describe('Promptfoo SQLite observatory adapter', () => {
  it('normalizes evidence and traces without mutating the source database', () => {
    const {database, path} = fixtureDatabase();
    insertRun(database, evidence('failed'), 'result-1');
    database.close();

    const before = snapshotSqliteFiles(path);
    const [run] = readPromptfooSqlite(path);
    const after = snapshotSqliteFiles(path);

    expect(run).toMatchObject({
      id: 'run-failed',
      scenario: {id: 'document.create-chart-map', version: 1},
      profile: {name: 'document-charts-maps', version: 1},
      repository: {commitSha: 'abc123'},
      status: 'failed',
      counts: {tools: 1, nestedAgents: 1, errors: 0},
    });
    expect(run?.spans).toHaveLength(1);
    expect(run?.unknownMetadata).toHaveProperty(
      'evalConfig.futureConfig',
      true,
    );
    expect(after).toEqual(before);
  });

  it('associates spans through each result trace linkage', () => {
    const {database, path} = fixtureDatabase();
    insertRun(
      database,
      {...evidence('passed'), runId: 'run-one'},
      'result-1',
      'trace-1',
    );
    insertRun(
      database,
      {...evidence('failed'), runId: 'run-two'},
      'result-2',
      'trace-2',
    );
    database.close();

    const runs = readPromptfooSqlite(path);
    expect(runs.find((run) => run.id === 'run-one')?.spans).toEqual([
      expect.objectContaining({traceId: 'trace-1'}),
    ]);
    expect(runs.find((run) => run.id === 'run-two')?.spans).toEqual([
      expect.objectContaining({traceId: 'trace-2'}),
    ]);
  });

  it('fails clearly when required Promptfoo columns are unavailable', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sqlrooms-evals-'));
    directories.push(directory);
    const path = join(directory, 'old.db');
    const database = new DatabaseSync(path);
    database.exec(
      'CREATE TABLE evals (id TEXT); CREATE TABLE eval_results (id TEXT);',
    );
    database.close();

    expect(() => readPromptfooSqlite(path)).toThrow(
      UnsupportedPromptfooSchemaError,
    );
    expect(() => readPromptfooSqlite(path)).toThrow('missing column(s)');
  });

  it('exports, filters, summarizes, and compares the normalized read model', () => {
    const {database, path} = fixtureDatabase();
    insertRun(database, evidence('passed'), 'result-1');
    database.close();

    const exported = exportPromptfooSqlite(
      path,
      new Date('2026-08-19T13:00:00.000Z'),
    );
    const filtered = filterObservatoryRuns(exported.runs, {
      scenario: 'document.create-chart-map',
      status: 'passed',
    });
    expect(exported.schemaVersion).toBe(1);
    expect(summarizeObservatoryRuns(filtered)).toMatchObject({
      runCount: 1,
      passed: 1,
      passRate: 1,
      totalTokens: 120,
    });

    const failed = {
      ...filtered[0]!,
      id: 'failed-copy',
      status: 'failed' as const,
      latencyMs: 1300,
      checkResults: [{...filtered[0]!.checkResults[0]!, pass: false, score: 0}],
    };
    expect(compareObservatoryRuns(failed, filtered[0]!)).toMatchObject({
      latencyDeltaMs: 300,
      newlyFailingChecks: ['workspace-shape'],
    });
    expect(computeCalibrationRates([filtered[0]!, failed])).toEqual([
      expect.objectContaining({
        scenarioId: 'document.create-chart-map',
        checkId: 'workspace-shape',
        total: 2,
        passed: 1,
        passRate: 0.5,
      }),
    ]);

    const lateRun = {
      ...filtered[0]!,
      id: 'late-run',
      createdAt: '2026-08-21T23:59:59.999Z',
    };
    expect(filterObservatoryRuns([lateRun], {to: '2026-08-21'})).toEqual([
      lateRun,
    ]);
    expect(filterObservatoryRuns([lateRun], {to: '2026-08-20'})).toEqual([]);

    const selected = {
      ...filtered[0]!,
      id: 'selected',
      createdAt: '2026-08-21T12:00:00.000Z',
      model: {...filtered[0]!.model, revision: 'revision-2'},
    };
    const wrongRevision = {
      ...filtered[0]!,
      id: 'wrong-revision',
      createdAt: '2026-08-21T11:00:00.000Z',
      model: {...filtered[0]!.model, revision: 'revision-1'},
    };
    const matchingRevision = {
      ...filtered[0]!,
      id: 'matching-revision',
      createdAt: '2026-08-21T10:00:00.000Z',
      model: {...filtered[0]!.model, revision: 'revision-2'},
    };
    const wrongScenarioVersion = {
      ...matchingRevision,
      id: 'wrong-scenario-version',
      createdAt: '2026-08-21T11:30:00.000Z',
      scenario: {...matchingRevision.scenario, version: 2},
    };
    expect(
      findAutomaticBaseline(
        [wrongRevision, wrongScenarioVersion, matchingRevision, selected],
        selected,
      )?.id,
    ).toBe('matching-revision');

    const markdown = renderObservatoryMarkdown({
      ...exported,
      runs: [
        filtered[0]!,
        {
          ...filtered[0]!,
          id: 'different-cohort',
          repository: {commitSha: 'different-commit'},
          model: {...filtered[0]!.model, modelId: 'different-model'},
        },
      ],
    });
    expect(markdown).toContain('- Commit: mixed');
    expect(markdown).toContain('- Model: mixed');

    const providerMarkdown = renderObservatoryMarkdown({
      ...exported,
      runs: [
        filtered[0]!,
        {
          ...filtered[0]!,
          id: 'different-provider',
          model: {...filtered[0]!.model, provider: 'direct'},
        },
      ],
    });
    expect(providerMarkdown).toContain('- Model: mixed');

    const upstreamProviderMarkdown = renderObservatoryMarkdown({
      ...exported,
      runs: [
        filtered[0]!,
        {
          ...filtered[0]!,
          id: 'different-upstream-provider',
          model: {...filtered[0]!.model, upstreamProvider: 'anthropic'},
        },
      ],
    });
    expect(upstreamProviderMarkdown).toContain('- Model: mixed');
  });
});
