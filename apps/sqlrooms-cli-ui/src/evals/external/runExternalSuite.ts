import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {RunEvidence} from '@sqlrooms/evals';
import {
  createClaudeHarness,
  createCodexHarness,
  describeRepository,
  hashFiles,
  runExternalScenario,
  type ExternalHarness,
  type ExternalRunResource,
} from '@sqlrooms/evals/external';
import {createCliCapabilityRuntime} from '../../createCliCapabilityRuntime';
import {resolveCliCapabilityProfile} from '../../profiles';
import {createCliHeadlessWorkspace} from '../createCliHeadlessWorkspace';
import {getOpenRouterEvalModel} from '../evalModel';
import {loadLocalEvalEnvironment} from '../loadLocalEvalEnvironment';
import {CLI_BEHAVIORAL_SCENARIOS, createCliScenarioChecks} from '../scenarios';
import {snapshotCliEvalState} from '../snapshot';
import {fixtureWorkspaceMode, seedDocument} from '../workspaceFixture';
import {createCliMcpServer} from './mcpHost';
import {
  describeIsolatedEvalCommand,
  EXTERNAL_EVAL_POLICY,
  isolatedEvalPolicy,
} from './policy';

const SKILL_FILES = [
  'SKILL.md',
  'references/documents.md',
  'references/charts.md',
  'references/maps.md',
];

/** Builds the selected harness with the SQLRooms skill, plugin and policy. */
function createHarness(options: {
  harness: 'codex' | 'claude';
  skillDir: string;
  model: string;
  modelProvider: string;
}): ExternalHarness {
  if (options.harness === 'claude')
    return createClaudeHarness({
      pluginDir: path.resolve(options.skillDir, '../../claude-plugin'),
      pluginFiles: [{from: options.skillDir, to: 'skills/sqlrooms'}],
      skillId: 'sqlrooms:sqlrooms',
      skillPath: 'skills/sqlrooms',
      requiredReferences: ['documents.md', 'charts.md', 'maps.md'],
      mcpTools: 'mcp__sqlrooms__*',
      appendSystemPrompt:
        'Use the native sqlrooms:sqlrooms skill before working. Explicitly read its SKILL.md and the documents, charts, and maps references for this auditable run. Use only MCP for workspace reads and writes. The host is an isolated disposable evaluation fixture; rendering is unavailable. Do not read repository source, evaluation evidence, or unrelated user files.',
      model: options.model || undefined,
      env: ({pluginDir, host}) => ({
        SQLROOMS_MCP_URL: host.url,
        SQLROOMS_CREDENTIAL_FILE: host.credentialFile,
        SQLROOMS_MCP_HEADERS_HELPER: [
          process.execPath,
          path.join(pluginDir, 'headers.mjs'),
        ]
          .map((part) => "'" + part.replace(/'/g, "'\\''") + "'")
          .join(' '),
      }),
    });
  return createCodexHarness({
    skillDir: options.skillDir,
    skillName: 'sqlrooms',
    model: options.model,
    modelProvider: options.modelProvider as 'codex' | 'openrouter',
    instructions: `Use the installed SQLRooms skill to operate the SQLRooms MCP workspace. For this auditable run, explicitly read .agents/skills/sqlrooms/SKILL.md from disk even if native skill invocation already supplied its body, then read its focused references before authoring. The host is an isolated disposable fixture. Use MCP for all workspace reads and writes. Do not read repository source, evaluation evidence, or other user files. Rendering and capture are unavailable. Policy: ${JSON.stringify(EXTERNAL_EVAL_POLICY)}\n`,
  });
}

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
  onResource?: (resource: ExternalRunResource) => void;
}) {
  // Exclusive creation prevents overwriting a previous failed attempt.
  await mkdir(options.outputDir, {recursive: false});
  const harnessId = options.harness ?? 'codex';
  const modelProvider =
    harnessId === 'claude' ? 'claude' : (options.modelProvider ?? 'codex');
  let model =
    harnessId === 'claude'
      ? (process.env.SQLROOMS_CLAUDE_EVAL_MODEL ?? '')
      : (options.model ?? 'gpt-5.5');
  const manifest: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    harness: harnessId,
    model,
    modelProvider,
    policy: EXTERNAL_EVAL_POLICY,
    scenarios: CLI_BEHAVIORAL_SCENARIOS.map(({id, version}) => ({id, version})),
    attempts: 'One attempt per scenario; no automatic retries.',
  };
  const writeManifest = () =>
    writeFile(
      path.join(options.outputDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    );
  await writeManifest();
  let harness: ExternalHarness;
  let harnessDescription: Awaited<ReturnType<ExternalHarness['describe']>>;
  try {
    if (modelProvider === 'openrouter') {
      loadLocalEvalEnvironment();
      model = options.model ?? getOpenRouterEvalModel();
    }
    model = model.trim();
    manifest.model = model;
    harness = createHarness({
      harness: harnessId,
      skillDir: options.skillDir,
      model,
      modelProvider,
    });
    harnessDescription = await harness.describe();
    Object.assign(manifest, harnessDescription);
    manifest.executionBundleSha256 = createHash('sha256')
      .update(await readFile(fileURLToPath(import.meta.url)))
      .digest('hex');
    manifest.repository = describeRepository();
    manifest.skill = {
      name: 'sqlrooms',
      version: 5,
      files: await hashFiles(options.skillDir, SKILL_FILES),
    };
  } catch (error) {
    manifest.failureKind = 'setup';
    manifest.error = String(error);
    await writeManifest();
    throw error;
  }
  await writeManifest();
  const profile = resolveCliCapabilityProfile({
    profileName: 'document-charts-maps',
  });
  const results: RunEvidence[] = [];
  for (const scenario of CLI_BEHAVIORAL_SCENARIOS) {
    if (options.signal?.aborted) break;
    const evidence = await runExternalScenario({
      harness,
      harnessDescription,
      scenario,
      checks: createCliScenarioChecks(scenario),
      outputDir: options.outputDir,
      target: {
        type: `cli-external-${harnessId}`,
        profileName: 'document-charts-maps',
        profileVersion: profile.version,
      },
      repository: manifest.repository as RunEvidence['repository'],
      timeoutMs: options.timeoutMs,
      signal: options.signal,
      onResource: options.onResource,
      metadata: {
        skill: manifest.skill as never,
        executionBundleSha256: manifest.executionBundleSha256 as string,
        policy: EXTERNAL_EVAL_POLICY as never,
        sqlroomsModelCalls: 0,
        skillLoading:
          harnessId === 'claude'
            ? 'Native --plugin-dir and Skill invocation; successful guidance/reference reads required.'
            : 'Native .agents/skills discovery and explicit $sqlrooms invocation; raw harness output retained.',
      },
      async prepare(recorder) {
        const workspace = createCliHeadlessWorkspace();
        try {
          await workspace.initialize();
          const mode = fixtureWorkspaceMode(scenario);
          if (mode !== 'empty')
            seedDocument(workspace.store, scenario, 0, mode);
          const state = workspace.store.getState();
          if ('ai' in state || 'artifactAi' in state || 'aiSettings' in state)
            throw new Error('External target contains AI state.');
          const runtime = createCliCapabilityRuntime({
            store: workspace.store,
            policy: isolatedEvalPolicy,
            describeCommand: describeIsolatedEvalCommand,
            onInvocation: (trace) => {
              recorder.recordEvent({
                type: 'tool',
                name: trace.capability.name,
                data: {
                  requestId: trace.context.requestId,
                  durationMs: trace.durationMs,
                  inputBytes: trace.inputBytes,
                  outputBytes: trace.outputBytes,
                  result: trace.result,
                },
              });
              if (!trace.result.ok)
                recorder.recordError({
                  name: trace.result.code,
                  message: trace.result.message,
                });
              void recorder.noteStateChange();
            },
          });
          return {
            createServer: ({onRequest}) =>
              createCliMcpServer(runtime, onRequest),
            snapshot: () => snapshotCliEvalState(workspace.store.getState()),
            database: (finalState) => ({
              tables: finalState.tables ?? [],
            }),
            cancel: () => runtime.dispose(),
            drain: () => runtime.drain(),
            dispose: () => workspace.dispose(),
          };
        } catch (error) {
          await workspace.dispose();
          throw error;
        }
      },
    });
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
  await writeManifest();
  return results;
}
