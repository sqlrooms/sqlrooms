import {describe, expect, it, jest} from '@jest/globals';
import {
  createAnswerGroundingOracle,
  createScriptedLanguageModel,
  createWorkspaceStateOracle,
  defineScenario,
  type JsonValue,
} from '@sqlrooms/evals';
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
