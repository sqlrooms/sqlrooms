import {describe, expect, it, jest} from '@jest/globals';
import {
  createAnswerGroundingOracle,
  createErrorOracle,
  createScriptedLanguageModel,
  createWorkspaceStateOracle,
  defineScenario,
  type JsonValue,
} from '@sqlrooms/evals';
import {CLI_ARTIFACT_TYPES} from '../../artifactTypeIds';
import {createCliEvalTarget} from '../createCliEvalTarget';
import {CLI_EVAL_TARGET_TABLE} from '../fixture';

function workspaceFacts(workspace: JsonValue | undefined) {
  return workspace as {
    worksheets: Array<{
      blocks: Array<{
        type: string;
        tableName?: string;
        blockType?: string;
        blockInstanceId?: string;
      }>;
    }>;
    maps: Array<{config: {datasets: Record<string, unknown>}}>;
  };
}

describe('createCliEvalTarget', () => {
  it('builds artifact capabilities and commands from the selected profile', async () => {
    const scripted = createScriptedLanguageModel({steps: []});
    const target = createCliEvalTarget({model: scripted.model});

    try {
      await target.initialize();
      const state = target.store.getState();
      expect(Object.keys(state.artifacts.artifactTypes).sort()).toEqual(
        [...CLI_ARTIFACT_TYPES].sort(),
      );
      expect(
        Object.fromEntries(
          CLI_ARTIFACT_TYPES.map((type) => [
            type,
            state.artifacts.artifactTypes[type]?.canCreate,
          ]),
        ),
      ).toEqual(
        Object.fromEntries(
          CLI_ARTIFACT_TYPES.map((type) => [type, type === 'worksheet']),
        ),
      );
      expect(
        state.commands
          .listCommands()
          .map((command) => command.id)
          .filter((id) => id.endsWith('.create-artifact')),
      ).toEqual(['worksheet.create-artifact']);
    } finally {
      await target.dispose();
    }
  });

  it('runs the production chat and nested worksheet tool loop without a browser or network', async () => {
    const scripted = createScriptedLanguageModel({
      steps: [
        {
          expectation: {promptIncludes: ['Current artifact: worksheet']},
          content: [
            {
              type: 'tool-call',
              toolName: 'block_document_agent',
              input: {
                reasoning: 'Build the requested worksheet visualizations.',
                intent: 'Add a metric chart and geographic event map.',
                blockDocumentId: 'eval-cli.worksheet-chart-map-0',
                maxSteps: 8,
              },
            },
          ],
        },
        {
          expectation: {
            promptIncludes: ['worksheet builder AI agent', 'direct map'],
          },
          content: [
            {
              type: 'tool-call',
              toolName: 'create_block_document_chart_histogram',
              input: {
                tableName: CLI_EVAL_TARGET_TABLE,
                reasoning: 'Show the distribution of the numeric metric.',
                settings: {field: 'metric', color: '#2563eb'},
                title: 'Metric distribution',
              },
            },
            {
              type: 'tool-call',
              toolName: 'create_block_document_map_block',
              input: {
                reasoning: 'Map event locations from the intended table.',
                title: 'Event locations',
                tableName: CLI_EVAL_TARGET_TABLE,
                config: {
                  datasets: {
                    events: {source: {tableName: CLI_EVAL_TARGET_TABLE}},
                  },
                  spec: {
                    layers: [
                      {
                        '@@type': 'GeoArrowScatterplotLayer',
                        _sqlroomsBinding: {
                          dataset: 'events',
                          longitudeColumn: 'longitude',
                          latitudeColumn: 'latitude',
                        },
                      },
                    ],
                  },
                  fitToData: {
                    dataset: 'events',
                    longitudeColumn: 'longitude',
                    latitudeColumn: 'latitude',
                  },
                },
              },
            },
          ],
        },
        {
          content: [
            {
              type: 'text',
              text: 'Created the metric chart and event map in the worksheet.',
            },
          ],
        },
        {
          content: [
            {
              type: 'text',
              text: 'Created a metric distribution chart and event map from analytics.events.',
            },
          ],
        },
      ],
    });
    const target = createCliEvalTarget({model: scripted.model});

    try {
      const evidence = await target.run({
        scenario: defineScenario({
          id: 'cli.worksheet-chart-map',
          version: 1,
          title: 'Create a worksheet chart and map',
          compatibleProfiles: ['worksheet-charts-maps'],
          fixture: {targetTable: CLI_EVAL_TARGET_TABLE},
          turns: [
            {
              id: 'create',
              input:
                'In the current worksheet, chart metric and map latitude/longitude from analytics.events, not archive.events.',
            },
          ],
          expectations: [
            {oracleId: 'workspace', description: 'Chart and map are durable.'},
            {
              oracleId: 'answer',
              description: 'Answer names the intended table.',
            },
          ],
        }),
        oracles: [
          createWorkspaceStateOracle({
            id: 'workspace',
            evaluate: (workspace) => {
              const facts = workspaceFacts(workspace);
              const [worksheet] = facts.worksheets;
              const chart = worksheet?.blocks.find(
                (block) => block.type === 'chart',
              );
              const map = worksheet?.blocks.find(
                (block) =>
                  block.type === 'statefulBlock' && block.blockType === 'map',
              );
              const pass =
                facts.worksheets.length === 1 &&
                chart?.tableName === CLI_EVAL_TARGET_TABLE &&
                Boolean(map?.blockInstanceId) &&
                facts.maps.length === 1;
              return {
                pass,
                reason: pass
                  ? 'One worksheet contains a canonical chart and direct map.'
                  : 'Expected canonical chart/map state was not materialized.',
                evidence: {
                  worksheetCount: facts.worksheets.length,
                  chartTable: chart?.tableName ?? null,
                  mapCount: facts.maps.length,
                },
              };
            },
          }),
          createAnswerGroundingOracle({
            id: 'answer',
            evaluate: (answer) => ({
              pass: answer.includes('analytics.events'),
              reason: 'The final answer identifies the intended table.',
              evidence: {answer},
            }),
          }),
        ],
      });

      expect(evidence.status).toBe('passed');
      expect(evidence.target).toEqual({
        type: 'cli-in-process',
        profileName: 'worksheet-charts-maps',
        profileVersion: 1,
      });
      expect(
        evidence.events.some((event) => event.type === 'nested-agent'),
      ).toBe(true);
      expect(evidence.events.some((event) => event.type === 'mutation')).toBe(
        true,
      );
      expect(evidence.events.map((event) => event.name)).toEqual(
        expect.arrayContaining([
          'create_block_document_chart_histogram',
          'create_block_document_map_block',
        ]),
      );
      expect(evidence.oracleResults.every((result) => result.pass)).toBe(true);
      scripted.assertComplete();
    } finally {
      await target.dispose();
    }
  }, 30_000);

  it('resets workspace and session state before every run', async () => {
    const scripted = createScriptedLanguageModel({
      steps: [
        {content: [{type: 'text', text: 'First run complete.'}]},
        {content: [{type: 'text', text: 'Second run complete.'}]},
      ],
    });
    const target = createCliEvalTarget({model: scripted.model});
    const scenario = defineScenario({
      id: 'cli.repeated-run',
      version: 1,
      title: 'Repeated isolated run',
      compatibleProfiles: ['worksheet-charts-maps'],
      turns: [{id: 'run', input: 'Complete this isolated run.'}],
      expectations: [{oracleId: 'answer', description: 'The run completes.'}],
    });
    const oracles = [
      createAnswerGroundingOracle({
        id: 'answer',
        evaluate: (answer) => ({
          pass: answer.includes('run complete'),
          reason: 'The scripted run completed.',
        }),
      }),
    ];

    try {
      await target.run({scenario, oracles});
      target.store.getState().deckMaps.ensureMap('stale-map');
      const connector = await target.store.getState().db.getConnector();
      await connector.execute('CREATE TABLE derived_events AS SELECT 1 AS id')
        .result;
      await target.store.getState().db.refreshTableSchemas();
      const roomConfig = target.store.getState().room.config;
      target.store.getState().room.setConfig({
        ...roomConfig,
        dataSources: [
          {
            type: 'sql',
            sqlQuery: 'SELECT 1 AS id',
            tableName: 'derived_events',
          },
        ],
      });
      expect(target.store.getState().room.config.dataSources).toHaveLength(1);

      const evidence = await target.run({scenario, oracles});
      const initialState = evidence.metadata.initialState as {
        artifacts: {artifactsById: Record<string, unknown>};
        maps: unknown[];
        tables: string[];
      };
      const finalState = workspaceFacts(evidence.finalState);

      expect(Object.keys(initialState.artifacts.artifactsById)).toHaveLength(0);
      expect(initialState.maps).toHaveLength(0);
      expect(
        initialState.tables.some((table) => table.includes('derived_events')),
      ).toBe(false);
      expect(finalState.worksheets).toHaveLength(1);
      expect(finalState.maps).toHaveLength(0);
      expect(target.store.getState().room.config.dataSources).toHaveLength(0);
      expect(target.store.getState().ai.config.sessions).toHaveLength(1);
      scripted.assertComplete();
    } finally {
      await target.dispose();
    }
  }, 30_000);

  it('rejects overlapping runs so they cannot mutate the shared store', async () => {
    const scripted = createScriptedLanguageModel({
      steps: [{content: [{type: 'text', text: 'First run complete.'}]}],
    });
    let signalStarted!: () => void;
    let releaseStream!: () => void;
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const streamGate = new Promise<void>((resolve) => {
      releaseStream = resolve;
    });
    const slowModel = {
      ...scripted.model,
      doStream: async (
        callOptions: Parameters<typeof scripted.model.doStream>[0],
      ) => {
        signalStarted();
        await streamGate;
        return scripted.model.doStream(callOptions);
      },
    };
    const target = createCliEvalTarget({model: slowModel});
    const scenario = defineScenario({
      id: 'cli.concurrent-run',
      version: 1,
      title: 'Concurrent run isolation',
      compatibleProfiles: ['worksheet-charts-maps'],
      turns: [{id: 'run', input: 'Complete this run.'}],
      expectations: [{oracleId: 'answer', description: 'The run completes.'}],
    });
    const oracles = [
      createAnswerGroundingOracle({
        id: 'answer',
        evaluate: () => ({pass: true, reason: 'The first run completed.'}),
      }),
    ];

    try {
      const firstRun = target.run({scenario, oracles});
      await started;
      await expect(target.run({scenario, oracles})).rejects.toThrow(
        'already has a run in progress',
      );
      releaseStream();
      await expect(firstRun).resolves.toMatchObject({status: 'passed'});
      scripted.assertComplete();
    } finally {
      releaseStream();
      await target.dispose();
    }
  }, 30_000);

  it('associates artifacts created by AI commands with the invoking session', async () => {
    const scripted = createScriptedLanguageModel({steps: []});
    const target = createCliEvalTarget({model: scripted.model});

    try {
      await target.initialize();
      const initialArtifactId = target.store
        .getState()
        .artifacts.createArtifact({
          type: 'worksheet',
          title: 'Initial worksheet',
        });
      const sessionId = target.store
        .getState()
        .artifactAi.createArtifactScopedSession();
      expect(sessionId).toBeDefined();

      const result = await target.store.getState().commands.invokeCommand(
        'worksheet.create-artifact',
        {title: 'Created by AI'},
        {
          surface: 'ai',
          actor: 'eval-test',
          metadata: {aiSessionId: sessionId},
        },
      );
      const createdArtifactId = (result.data as {artifactId?: string})
        .artifactId;

      expect(initialArtifactId).toBeDefined();
      expect(createdArtifactId).toBeDefined();
      expect(
        target.store
          .getState()
          .artifactAi.hasSessionArtifactLink(sessionId!, createdArtifactId!),
      ).toBe(true);
    } finally {
      await target.dispose();
    }
  });

  it('cancels and awaits a timed-out session before returning evidence', async () => {
    const scripted = createScriptedLanguageModel({
      steps: [{content: [{type: 'text', text: 'Too late.'}]}],
    });
    let abortObserved = false;
    let cancellationSettled = false;
    const slowModel = {
      ...scripted.model,
      doStream: async (
        callOptions: Parameters<typeof scripted.model.doStream>[0],
      ) => {
        await new Promise<void>((resolve, reject) => {
          const fallback = setTimeout(resolve, 1_000);
          callOptions.abortSignal?.addEventListener(
            'abort',
            () => {
              abortObserved = true;
              clearTimeout(fallback);
              setTimeout(() => {
                cancellationSettled = true;
                reject(new DOMException('Aborted', 'AbortError'));
              }, 10);
            },
            {once: true},
          );
        });
        return scripted.model.doStream(callOptions);
      },
    };
    const target = createCliEvalTarget({model: slowModel, timeoutMs: 5});

    try {
      const evidence = await target.run({
        scenario: defineScenario({
          id: 'cli.timeout',
          version: 1,
          title: 'Timeout cancellation',
          compatibleProfiles: ['worksheet-charts-maps'],
          turns: [{id: 'run', input: 'Wait for the timeout.'}],
          expectations: [
            {oracleId: 'answer', description: 'The timeout is captured.'},
          ],
        }),
        oracles: [
          createAnswerGroundingOracle({
            id: 'answer',
            evaluate: () => ({pass: true, reason: 'Timeout captured.'}),
          }),
        ],
      });

      expect(evidence.status).toBe('error');
      expect(abortObserved).toBe(true);
      expect(cancellationSettled).toBe(true);
      expect(JSON.stringify(evidence)).toContain('timed out');
    } finally {
      await target.dispose();
    }
  }, 30_000);

  it('redacts sensitive values across the complete evidence envelope', async () => {
    const secret = 'provider-secret-token';
    const scripted = createScriptedLanguageModel({
      steps: [
        {
          expectation: {promptIncludes: [secret]},
          content: [{type: 'text', text: `Completed with ${secret}.`}],
        },
      ],
    });
    const target = createCliEvalTarget({
      model: scripted.model,
      sensitiveValues: [secret],
      repository: {
        commitSha: `sha-${secret}`,
        dirty: false,
        workflowUrl: `https://example.test/run?token=${secret}`,
      },
    });

    try {
      const evidence = await target.run({
        scenario: defineScenario({
          id: 'cli.redaction',
          version: 1,
          title: 'Complete evidence redaction',
          compatibleProfiles: ['worksheet-charts-maps'],
          turns: [{id: 'run', input: `Use ${secret} safely.`}],
          expectations: [
            {oracleId: 'answer', description: 'The answer is evaluated.'},
          ],
        }),
        oracles: [
          createAnswerGroundingOracle({
            id: 'answer',
            evaluate: (answer) => ({
              pass: answer.includes(secret),
              reason: `Observed ${secret}.`,
              evidence: {answer, secret},
            }),
          }),
        ],
      });

      const serialized = JSON.stringify(evidence);
      expect(evidence.status).toBe('passed');
      expect(serialized).toContain('[REDACTED]');
      expect(serialized).not.toContain(secret);
      scripted.assertComplete();
    } finally {
      await target.dispose();
    }
  }, 30_000);

  it('records actionable redacted transport errors', async () => {
    const secret = 'provider-secret-token';
    const scripted = createScriptedLanguageModel({
      steps: [
        {
          expectation: {promptIncludes: [secret]},
          content: [{type: 'text', text: 'unreachable'}],
        },
      ],
    });
    const target = createCliEvalTarget({
      model: scripted.model,
      sensitiveValues: [secret],
    });
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const evidence = await target.run({
        scenario: defineScenario({
          id: 'cli.transport-error',
          version: 1,
          title: 'Transport error evidence',
          compatibleProfiles: ['worksheet-charts-maps'],
          turns: [{id: 'run', input: 'Trigger the scripted mismatch.'}],
          expectations: [
            {oracleId: 'error', description: 'The error is retained safely.'},
          ],
        }),
        oracles: [
          createErrorOracle({
            id: 'error',
            evaluate: (errors) => ({
              pass: errors.length > 0,
              reason: 'The transport error was captured.',
            }),
          }),
        ],
      });

      const serialized = JSON.stringify(evidence);
      expect(evidence.status).toBe('error');
      expect(evidence.events.some((event) => event.type === 'error')).toBe(
        true,
      );
      expect(serialized).toContain('[REDACTED]');
      expect(serialized).not.toContain(secret);
    } finally {
      await target.dispose();
      consoleError.mockRestore();
    }
  }, 30_000);
});
