import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import type {Server} from '@modelcontextprotocol/sdk/server/index.js';
import type {
  BehavioralCheck,
  BehavioralCheckResult,
  ObservedError,
} from '../behavioralCheck.js';
import {
  evaluateBehavioralChecks,
  summarizeBehavioralCheckResults,
} from '../behavioralCheck.js';
import type {RunEvidence} from '../evidence.js';
import {RUN_EVIDENCE_SCHEMA_VERSION, RunEvidenceSchema} from '../evidence.js';
import type {JsonObject, JsonValue} from '../json.js';
import type {ScenarioDefinition} from '../scenario.js';
import type {ExternalHarness, HarnessOutput} from './harness.js';
import {startEvalMcpHost} from './mcpHost.js';
import {runHarnessProcess, type HarnessResult} from './process.js';

const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as JsonObject;

/** Resources reported to an external process supervisor. */
export type ExternalRunResource = {
  kind: 'workspace' | 'harness';
  value: string | number;
  active: boolean;
};

/** Recording API handed to the application while it prepares its target. */
export type ExternalTargetRecorder = {
  /** Records one ordered evidence event, such as a capability invocation. */
  recordEvent(event: {
    type: RunEvidence['events'][number]['type'];
    name?: string;
    data?: unknown;
  }): void;
  /** Records an operation error observed by the application. */
  recordError(error: ObservedError): void;
  /**
   * Snapshots the target and records a mutation event when state changed.
   * Synchronous snapshots are applied before this returns.
   */
  noteStateChange(): Promise<void>;
};

/** An application workspace prepared for one external run. */
export type PreparedExternalTarget = {
  /** Builds a fresh MCP server per HTTP request over the shared workspace. */
  createServer(hooks: {
    /** Call for every MCP request, with the call input for tool calls. */
    onRequest(method: string, input?: unknown): void;
  }): Server;
  /** Normalized, JSON-serializable workspace state. */
  snapshot(): JsonObject | Promise<JsonObject>;
  /** Database view passed to checks; defaults to `undefined`. */
  database?(state: JsonObject): JsonValue | undefined;
  /** Stops accepting new work before the MCP host closes. */
  cancel?(): void;
  /** Waits for in-flight work after the MCP host closed. */
  drain?(): Promise<void>;
  /** Releases the workspace after the final snapshot. */
  dispose(): Promise<void>;
};

/** A scenario reference for runs graded outside `@sqlrooms/evals`. */
export type ExternalScenarioRef = Pick<
  ScenarioDefinition,
  'id' | 'version' | 'turns'
>;

/** Options for {@link runExternalScenario}. */
export type RunExternalScenarioOptions = {
  harness: ExternalHarness;
  /** Result of `harness.describe()`, resolved once per suite. */
  harnessDescription: JsonObject;
  /** Only the first turn is sent; multi-turn scenarios are not supported. */
  scenario: ScenarioDefinition | ExternalScenarioRef;
  /**
   * Checks graded into the evidence. Requires a full scenario definition.
   * When omitted, the run is graded elsewhere (for example by Promptfoo
   * assertions) and its status reflects only errors.
   */
  checks?: readonly BehavioralCheck[];
  /** Existing directory for raw harness streams and evidence. */
  outputDir: string;
  target: {type: string; profileName: string; profileVersion: number};
  repository?: RunEvidence['repository'];
  repetition?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onResource?: (resource: ExternalRunResource) => void;
  /** Prepares a fresh workspace; must release what it acquired if it throws. */
  prepare(recorder: ExternalTargetRecorder): Promise<PreparedExternalTarget>;
  /** Extra metadata recorded in the evidence. */
  metadata?: JsonObject;
};

/**
 * Runs one scenario through an actual external harness over a real MCP host
 * and returns validated run evidence.
 *
 * Never retries or repairs model output. A missing CLI, failed login, failed
 * transport, unobserved guidance read, timeout, cancellation, operation
 * failure or cleanup failure is an error, never a pass. Behavioral check
 * failures are reported separately as `failed`.
 */
export async function runExternalScenario(
  options: RunExternalScenarioOptions,
): Promise<RunEvidence> {
  const {harness, scenario} = options;
  if (options.checks && !('expectations' in scenario))
    throw new Error('Checks require a full scenario definition.');
  const repetition = options.repetition ?? 0;
  const filePrefix = path.join(
    options.outputDir,
    repetition === 0 ? scenario.id : `${scenario.id}.r${repetition}`,
  );
  const startedAt = new Date();
  const events: RunEvidence['events'] = [];
  const errors: ObservedError[] = [];
  const protocol: string[] = [];
  let failureKind: string | null = null;
  let initialState: JsonObject = {};
  let finalState: JsonObject = {};
  let finalAnswer = '';
  let processResult: HarnessResult | undefined;
  let harnessOutput: HarnessOutput | undefined;
  let cwd: string | undefined;
  let prepared: PreparedExternalTarget | undefined;
  let host: Awaited<ReturnType<typeof startEvalMcpHost>> | undefined;
  let invocation: string[] = [];
  const pushEvent = (event: {
    type: RunEvidence['events'][number]['type'];
    name?: string;
    data?: unknown;
  }) =>
    events.push({
      sequence: events.length,
      timestamp: new Date().toISOString(),
      type: event.type,
      ...(event.name ? {name: event.name} : {}),
      data: event.data === undefined ? {} : json(event.data),
    });
  const recordError = (error: unknown, kind: string) => {
    failureKind ??= kind;
    errors.push({
      name: error instanceof Error ? error.name : kind,
      message: String(error),
      metadata: {kind},
    });
  };
  const recorder: ExternalTargetRecorder = {
    recordEvent: pushEvent,
    recordError: (error) =>
      errors.push({...error, metadata: {kind: 'operation', ...error.metadata}}),
    noteStateChange() {
      if (!prepared) return Promise.resolve();
      const apply = (next: JsonObject) => {
        if (JSON.stringify(next) !== JSON.stringify(finalState)) {
          pushEvent({
            type: 'mutation',
            name: 'workspace-state',
            data: {finalState: next},
          });
          finalState = next;
        }
      };
      const next = prepared.snapshot();
      if (next instanceof Promise) return next.then(apply);
      apply(next);
      return Promise.resolve();
    },
  };
  try {
    cwd = await mkdtemp(path.join(tmpdir(), 'sqlrooms-external-'));
    options.onResource?.({kind: 'workspace', value: cwd, active: true});
    await harness.stage(cwd);
    prepared = await options.prepare(recorder);
    initialState = await prepared.snapshot();
    finalState = initialState;
    const target = prepared;
    host = await startEvalMcpHost({
      createServer: () =>
        target.createServer({
          onRequest(method, input) {
            protocol.push(method);
            if (input !== undefined)
              pushEvent({
                type: 'tool',
                name: 'mcp-request',
                data:
                  JSON.stringify(input).length <= 256 * 1024
                    ? input
                    : {truncated: true},
              });
          },
        }),
    });
    const prompt = scenario.turns[0]!.input;
    const call = harness.invocation({cwd, host, prompt});
    invocation = call.args;
    processResult = await runHarnessProcess({
      command: harness.command,
      args: call.args,
      cwd,
      env: call.env,
      timeoutMs: options.timeoutMs ?? 240_000,
      signal: options.signal,
      onProcess: (pid, active) =>
        options.onResource?.({kind: 'harness', value: pid, active}),
      evidencePrefix: filePrefix,
    });
    const stopped =
      processResult.cancelled ||
      processResult.timedOut ||
      processResult.outputLimited;
    if (processResult.cancelled)
      recordError(new Error('Harness cancelled.'), 'cancelled');
    else if (processResult.timedOut)
      recordError(new Error('Harness deadline exceeded.'), 'timeout');
    else if (processResult.outputLimited)
      recordError(new Error('Harness output limit exceeded.'), 'harness');
    try {
      harnessOutput = harness.readOutput(processResult.stdout);
    } catch (error) {
      // A stopped harness can leave a truncated JSONL line.
      recordError(error, 'harness');
    }
    if (harnessOutput) {
      finalAnswer = harnessOutput.finalAnswer;
      if (
        !stopped &&
        (processResult.exitCode !== 0 ||
          harnessOutput.failed ||
          !harnessOutput.completed)
      ) {
        const authentication =
          /unauthori[sz]ed|authenticat|not logged in|login required|401/i.test(
            processResult.stdout + processResult.stderr,
          );
        recordError(
          new Error(
            `Harness failed (exit ${processResult.exitCode}); see raw output.`,
          ),
          authentication ? 'authentication' : 'harness',
        );
      }
      for (const message of harness.verifyGuidance(harnessOutput))
        recordError(new Error(message), 'guidance');
    }
    if (
      !protocol.includes('tools/list') ||
      !protocol.some((method) => method.startsWith('tools/call:'))
    )
      recordError(
        new Error('Real MCP discovery and invocation were not observed.'),
        'transport',
      );
  } catch (error) {
    recordError(error, 'setup');
  } finally {
    try {
      prepared?.cancel?.();
      if (host) await host.dispose();
      await prepared?.drain?.();
    } catch (error) {
      recordError(error, 'cleanup');
    }
    if (prepared) {
      try {
        finalState = await prepared.snapshot();
      } catch (error) {
        recordError(error, 'cleanup');
      }
      try {
        await prepared.dispose();
      } catch (error) {
        recordError(error, 'cleanup');
      }
    }
    if (cwd) {
      try {
        await rm(cwd, {recursive: true, force: true});
        options.onResource?.({kind: 'workspace', value: cwd, active: false});
      } catch (error) {
        recordError(error, 'cleanup');
      }
    }
  }
  const endedAt = new Date();
  const mutations =
    JSON.stringify(initialState) === JSON.stringify(finalState)
      ? []
      : [{kind: 'workspace-state', data: {finalState}}];
  let checkResults: BehavioralCheckResult[] = [];
  if (options.checks && 'expectations' in scenario) {
    checkResults = await evaluateBehavioralChecks(options.checks, {
      scenario,
      target: options.target.type,
      workspace: finalState,
      database: prepared?.database?.(finalState),
      finalAnswer,
      errors,
      mutations,
      events,
      metadata: {initialState},
    });
  }
  const pass = options.checks
    ? summarizeBehavioralCheckResults(checkResults).pass
    : true;
  if (!pass && !failureKind) failureKind = 'behavior';
  for (const error of errors)
    pushEvent({type: 'error', name: error.name ?? 'Error', data: error});
  const usage = harnessOutput?.usage;
  const evidence = RunEvidenceSchema.parse({
    schemaVersion: RUN_EVIDENCE_SCHEMA_VERSION,
    runId: `${scenario.id}-${startedAt.getTime()}`,
    scenario: {id: scenario.id, version: scenario.version, repetition},
    target: options.target,
    repository: options.repository,
    model: {
      ...harness.model,
      observedModelId: harnessOutput?.observedModelId ?? null,
    },
    timing: {
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      latencyMs: endedAt.getTime() - startedAt.getTime(),
    },
    status: processResult?.cancelled
      ? 'cancelled'
      : errors.length
        ? 'error'
        : pass
          ? 'passed'
          : 'failed',
    promptTurns: scenario.turns,
    finalAnswer,
    finalState,
    events,
    checkResults,
    usage: usage
      ? {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          grader: {totalTokens: 0},
        }
      : undefined,
    metadata: {
      initialState,
      fixtureState: initialState,
      failureKind,
      ...options.harnessDescription,
      invocation,
      harnessDiagnostics: harnessOutput?.diagnostics ?? [],
      observedSkillReads:
        harnessOutput?.skillReads.map((read) => read.command) ?? [],
      mcpRequests: protocol,
      gradedBy: options.checks ? 'sqlrooms-checks' : 'external',
      cleanupCompleted: !errors.some(
        (error) => error.metadata?.kind === 'cleanup',
      ),
      ...options.metadata,
    },
  });
  await writeFile(
    `${filePrefix}.evidence.json`,
    JSON.stringify(evidence, null, 2),
  );
  return evidence;
}

/** Records the repository revision and whether the worktree is dirty. */
export function describeRepository(cwd?: string): {
  commitSha: string;
  dirty: boolean;
} {
  return {
    commitSha: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      timeout: 10_000,
    }).trim(),
    dirty: Boolean(
      execFileSync(
        'git',
        [
          '-c',
          'filter.lfs.process=',
          '-c',
          'filter.lfs.required=false',
          'status',
          '--porcelain',
        ],
        {cwd, encoding: 'utf8', timeout: 10_000},
      ).trim(),
    ),
  };
}

/** SHA-256 of each file, keyed by its path relative to `directory`. */
export async function hashFiles(
  directory: string,
  files: readonly string[],
): Promise<Record<string, string>> {
  return Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [
        file,
        createHash('sha256')
          .update(await readFile(path.join(directory, file)))
          .digest('hex'),
      ]),
    ),
  );
}
