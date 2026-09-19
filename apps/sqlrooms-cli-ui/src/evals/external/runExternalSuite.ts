import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cp, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {claudeArguments} from './claudeHarness';
import {readClaudeOutput} from './claudeOutput';
import {readCodexOutput} from './codexOutput';
import {findOtherCodexSkills} from './codexSkills';
import path from 'node:path';
import {
  evaluateBehavioralChecks,
  summarizeBehavioralCheckResults,
  RunEvidenceSchema,
  RUN_EVIDENCE_SCHEMA_VERSION,
  type RunEvidence,
  type JsonObject,
  type ObservedError,
} from '@sqlrooms/evals';
import {createCliCapabilityRuntime} from '../../createCliCapabilityRuntime';
import {createCliHeadlessWorkspace} from '../createCliHeadlessWorkspace';
import {CLI_BEHAVIORAL_SCENARIOS, createCliScenarioChecks} from '../scenarios';
import {snapshotCliEvalState} from '../snapshot';
import {fixtureWorkspaceMode, seedDocument} from '../workspaceFixture';
import {getOpenRouterEvalModel} from '../evalModel';
import {loadLocalEvalEnvironment} from '../loadLocalEvalEnvironment';
import {
  codexArguments,
  runHarnessProcess,
  type HarnessResult,
} from './codexHarness';
import {startEvalMcpHost} from './mcpHost';
import {
  describeIsolatedEvalCommand,
  EXTERNAL_EVAL_POLICY,
  isolatedEvalPolicy,
} from './policy';

const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as JsonObject;

/** Runs the two pinned scenarios once each. Never retries or repairs model output. */
export async function runExternalSuite(options: {
  outputDir: string;
  skillDir: string;
  /** Defaults to the existing Codex runner. */
  harness?: 'codex' | 'claude';
  model?: string;
  /** codex uses existing harness auth; openrouter uses OPENROUTER_API_KEY. */
  modelProvider?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Reports resources to the executable's independent process supervisor. */
  onResource?: (resource: {
    kind: 'workspace' | 'harness';
    value: string | number;
    active: boolean;
  }) => void;
}) {
  // Exclusive creation prevents overwriting a previous failed attempt.
  await mkdir(options.outputDir, {recursive: false});
  const started = new Date();
  const harness = options.harness ?? 'codex';
  const modelProvider =
    harness === 'claude' ? 'claude' : (options.modelProvider ?? 'codex');
  let model =
    harness === 'claude'
      ? (process.env.SQLROOMS_CLAUDE_EVAL_MODEL ?? '')
      : (options.model ?? 'gpt-5.5');
  const manifest: Record<string, unknown> = {
    startedAt: started.toISOString(),
    harness,
    model,
    modelProvider,
    policy: EXTERNAL_EVAL_POLICY,
    scenarios: CLI_BEHAVIORAL_SCENARIOS.map(({id, version}) => ({id, version})),
    attempts: 'One attempt per scenario; no automatic retries.',
  };
  await writeFile(
    path.join(options.outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  let version: string;
  let disabledSkills: string[];
  try {
    if (
      harness === 'codex' &&
      modelProvider !== 'codex' &&
      modelProvider !== 'openrouter'
    )
      throw new Error(`Unsupported SQLROOMS_EVAL_PROVIDER: ${modelProvider}`);
    if (modelProvider === 'openrouter') {
      loadLocalEvalEnvironment();
      model = options.model ?? getOpenRouterEvalModel();
      manifest.model = model;
      if (!process.env.OPENROUTER_API_KEY?.trim())
        throw new Error('Missing OPENROUTER_API_KEY for the external harness.');
    }
    model = model.trim();
    if (!model && harness === 'codex')
      throw new Error('SQLROOMS_EVAL_MODEL must be non-empty.');
    manifest.model = model;
    version = execFileSync(harness, ['--version'], {
      encoding: 'utf8',
      timeout: 10_000,
    }).trim();
    manifest.harnessVersion = version;
    if (harness === 'claude') {
      manifest.plugin = JSON.parse(
        await readFile(
          path.resolve(
            options.skillDir,
            '../../claude-plugin/.claude-plugin/plugin.json',
          ),
          'utf8',
        ),
      );
    }
    disabledSkills = harness === 'codex' ? await findOtherCodexSkills() : [];
    manifest.disabledSkillPaths = disabledSkills;
    manifest.executionBundleSha256 = createHash('sha256')
      .update(await readFile(fileURLToPath(import.meta.url)))
      .digest('hex');
    manifest.repository = {
      commitSha: execFileSync('git', ['rev-parse', 'HEAD'], {
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
          {encoding: 'utf8', timeout: 10_000},
        ).trim(),
      ),
    };
    const skillFiles = [
      'SKILL.md',
      'references/documents.md',
      'references/charts.md',
      'references/maps.md',
    ];
    manifest.skill = {
      name: 'sqlrooms',
      version: 5,
      files: Object.fromEntries(
        await Promise.all(
          skillFiles.map(async (file) => [
            file,
            createHash('sha256')
              .update(await readFile(path.join(options.skillDir, file)))
              .digest('hex'),
          ]),
        ),
      ),
    };
  } catch (error) {
    manifest.failureKind = 'setup';
    manifest.error = String(error);
    await writeFile(
      path.join(options.outputDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    );
    throw error;
  }
  await writeFile(
    path.join(options.outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  const skillContents = await readFile(
    path.join(options.skillDir, 'SKILL.md'),
    'utf8',
  );
  const results: RunEvidence[] = [];
  for (const scenario of CLI_BEHAVIORAL_SCENARIOS) {
    if (options.signal?.aborted) break;
    const startedAt = new Date();
    const events: RunEvidence['events'] = [];
    const errors: ObservedError[] = [];
    const protocol: string[] = [];
    let failureKind: string | null = null;
    let fixtureState: JsonObject = {},
      finalState: JsonObject = {};
    let finalAnswer = '';
    let processResult: HarnessResult | undefined;
    let harnessOutput:
      | ReturnType<typeof readCodexOutput>
      | ReturnType<typeof readClaudeOutput>
      | undefined;
    let cwd: string | undefined;
    let workspace: ReturnType<typeof createCliHeadlessWorkspace> | undefined;
    let host: Awaited<ReturnType<typeof startEvalMcpHost>> | undefined;
    let runtime: ReturnType<typeof createCliCapabilityRuntime> | undefined;
    let invocation: string[] = [];
    const recordError = (error: unknown, kind: string) => {
      failureKind ??= kind;
      errors.push({
        name: error instanceof Error ? error.name : kind,
        message: String(error),
        metadata: {kind},
      });
    };
    try {
      cwd = await mkdtemp(path.join(tmpdir(), 'sqlrooms-external-'));
      options.onResource?.({kind: 'workspace', value: cwd, active: true});
      if (harness === 'claude') {
        await cp(
          path.resolve(options.skillDir, '../../claude-plugin'),
          path.join(cwd, 'plugin'),
          {recursive: true},
        );
        await cp(options.skillDir, path.join(cwd, 'plugin/skills/sqlrooms'), {
          recursive: true,
        });
      } else {
        await cp(options.skillDir, path.join(cwd, '.agents/skills/sqlrooms'), {
          recursive: true,
        });
      }
      workspace = createCliHeadlessWorkspace();
      await workspace.initialize();
      const mode = fixtureWorkspaceMode(scenario);
      if (mode !== 'empty') seedDocument(workspace.store, scenario, 0, mode);
      fixtureState = snapshotCliEvalState(workspace.store.getState());
      const state = workspace.store.getState();
      if ('ai' in state || 'artifactAi' in state || 'aiSettings' in state)
        throw new Error('External target contains AI state.');
      runtime = createCliCapabilityRuntime({
        store: workspace.store,
        policy: isolatedEvalPolicy,
        describeCommand: describeIsolatedEvalCommand,
        onInvocation: (trace) => {
          events.push({
            sequence: events.length,
            timestamp: new Date().toISOString(),
            type: 'tool',
            name: trace.capability.name,
            data: json({
              requestId: trace.context.requestId,
              durationMs: trace.durationMs,
              inputBytes: trace.inputBytes,
              outputBytes: trace.outputBytes,
              result: trace.result,
            }),
          });
          if (!trace.result.ok)
            errors.push({
              name: trace.result.code,
              message: trace.result.message,
              metadata: {kind: 'operation'},
            });
          const next = snapshotCliEvalState(workspace!.store.getState());
          if (JSON.stringify(next) !== JSON.stringify(finalState)) {
            events.push({
              sequence: events.length,
              timestamp: new Date().toISOString(),
              type: 'mutation',
              name: 'workspace-state',
              data: {finalState: next},
            });
            finalState = next;
          }
        },
      });
      finalState = fixtureState;
      host = await startEvalMcpHost(runtime, (method, input) => {
        protocol.push(method);
        if (input !== undefined)
          events.push({
            sequence: events.length,
            timestamp: new Date().toISOString(),
            type: 'tool',
            name: 'mcp-request',
            data:
              JSON.stringify(input).length <= 256 * 1024
                ? json(input)
                : {truncated: true},
          });
      });
      // Connection and policy context are separate from the unmodified scenario.
      await writeFile(
        path.join(cwd, 'AGENTS.md'),
        `Use the installed SQLRooms skill to operate the SQLRooms MCP workspace. For this auditable run, explicitly read .agents/skills/sqlrooms/SKILL.md from disk even if native skill invocation already supplied its body, then read its focused references before authoring. The host is an isolated disposable fixture. Use MCP for all workspace reads and writes. Do not read repository source, evaluation evidence, or other user files. Rendering and capture are unavailable. Policy: ${JSON.stringify(EXTERNAL_EVAL_POLICY)}\n`,
      );
      invocation =
        harness === 'claude'
          ? claudeArguments({
              pluginDir: path.join(cwd, 'plugin'),
              model: model || undefined,
              prompt: scenario.turns[0]!.input,
            })
          : codexArguments({
              cwd,
              url: host.url,
              model,
              modelProvider:
                modelProvider === 'openrouter' ? 'openrouter' : 'codex',
              prompt: scenario.turns[0]!.input,
              disabledSkills,
            });
      processResult = await runHarnessProcess({
        command: harness,
        args: invocation,
        cwd,
        env:
          harness === 'claude'
            ? {
                ...process.env,
                SQLROOMS_MCP_URL: host.url,
                SQLROOMS_MCP_TOKEN: host.token,
              }
            : {
                PATH: process.env.PATH,
                HOME: process.env.HOME,
                CODEX_HOME: process.env.CODEX_HOME,
                TMPDIR: process.env.TMPDIR,
                ...(modelProvider === 'openrouter'
                  ? {OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY}
                  : {}),
                SQLROOMS_EVAL_MCP_TOKEN: host.token,
              },
        timeoutMs: options.timeoutMs ?? 240_000,
        signal: options.signal,
        onProcess: (pid, active) =>
          options.onResource?.({kind: 'harness', value: pid, active}),
        evidencePrefix: path.join(options.outputDir, scenario.id),
      });
      harnessOutput =
        harness === 'claude'
          ? readClaudeOutput(processResult.stdout)
          : readCodexOutput(processResult.stdout);
      finalAnswer = harnessOutput.finalAnswer;
      if (processResult.cancelled)
        recordError(new Error('Harness cancelled.'), 'cancelled');
      else if (processResult.timedOut)
        recordError(new Error('Harness deadline exceeded.'), 'timeout');
      else if (processResult.outputLimited)
        recordError(new Error('Harness output limit exceeded.'), 'harness');
      else if (
        processResult.exitCode !== 0 ||
        harnessOutput.failed ||
        !harnessOutput.completed
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
      if (
        ('skillInvoked' in harnessOutput && !harnessOutput.skillInvoked) ||
        !harnessOutput.skillReads.some((read) =>
          read.output.includes(skillContents.trim()),
        )
      ) {
        recordError(
          new Error('Successful native SQLRooms skill read was not observed.'),
          'guidance',
        );
      }
      if (
        harness === 'claude' &&
        !['documents.md', 'charts.md', 'maps.md'].every((name) =>
          harnessOutput!.skillReads.some(
            (read) =>
              read.command.endsWith('/references/' + name) &&
              read.output.length > 100,
          ),
        )
      )
        recordError(
          new Error('Successful focused reference reads were not observed.'),
          'guidance',
        );
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
        if (host) await host.dispose();
        else {
          runtime?.dispose();
          await runtime?.drain();
        }
      } catch (error) {
        recordError(error, 'cleanup');
      }
      if (workspace) {
        finalState = snapshotCliEvalState(workspace.store.getState());
        try {
          await workspace.dispose();
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
      JSON.stringify(fixtureState) === JSON.stringify(finalState)
        ? []
        : [{kind: 'workspace-state', data: {finalState}}];
    const checkResults = await evaluateBehavioralChecks(
      createCliScenarioChecks(scenario),
      {
        scenario,
        workspace: finalState,
        database: {tables: finalState.tables ?? []},
        finalAnswer,
        errors,
        mutations,
        metadata: {initialState: fixtureState},
      },
    );
    const pass = summarizeBehavioralCheckResults(checkResults).pass;
    if (!pass && !failureKind) failureKind = 'behavior';
    for (const error of errors)
      events.push({
        sequence: events.length,
        timestamp: endedAt.toISOString(),
        type: 'error',
        name: error.name ?? 'Error',
        data: json(error),
      });
    const usageRecord = harnessOutput?.usage;
    const evidence = RunEvidenceSchema.parse({
      schemaVersion: RUN_EVIDENCE_SCHEMA_VERSION,
      runId: `${scenario.id}-${startedAt.getTime()}`,
      scenario: {id: scenario.id, version: scenario.version, repetition: 0},
      target: {
        type: `cli-external-${harness}`,
        profileName: 'document-charts-maps',
        profileVersion: workspace?.profile.version ?? 1,
      },
      repository: manifest.repository,
      model: {
        provider:
          modelProvider === 'openrouter' ? 'openrouter' : `${harness}-harness`,
        modelId: model || 'harness-default',
        settings: harness === 'codex' ? {reasoningEffort: 'medium'} : {},
        observedModelId:
          harnessOutput && 'observedModelId' in harnessOutput
            ? harnessOutput.observedModelId
            : null,
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
      usage: usageRecord
        ? {
            inputTokens: usageRecord.input_tokens,
            outputTokens: usageRecord.output_tokens,
            grader: {totalTokens: 0},
          }
        : undefined,
      metadata: {
        initialState: fixtureState,
        fixtureState,
        failureKind,
        harnessVersion: version,
        invocation,
        skill: manifest.skill,
        harnessDiagnostics: harnessOutput?.diagnostics ?? [],
        observedSkillReads:
          harnessOutput?.skillReads.map((read) => read.command) ?? [],
        executionBundleSha256: manifest.executionBundleSha256,
        policy: EXTERNAL_EVAL_POLICY,
        mcpRequests: protocol,
        sqlroomsModelCalls: 0,
        skillLoading:
          harness === 'claude'
            ? 'Native --plugin-dir and Skill invocation; successful guidance/reference reads required.'
            : 'Native .agents/skills discovery and explicit $sqlrooms invocation; raw harness output retained.',
        cleanupCompleted: !errors.some(
          (error) => error.metadata?.kind === 'cleanup',
        ),
      },
    });
    await writeFile(
      path.join(options.outputDir, `${scenario.id}.evidence.json`),
      JSON.stringify(evidence, null, 2),
    );
    results.push(evidence);
  }
  manifest.endedAt = new Date().toISOString();
  manifest.results = results.map((result) => ({
    scenario: result.scenario.id,
    status: result.status,
  }));
  manifest.passed =
    results.length === CLI_BEHAVIORAL_SCENARIOS.length &&
    results.every((result) => result.status === 'passed');
  await writeFile(
    path.join(options.outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  return results;
}
