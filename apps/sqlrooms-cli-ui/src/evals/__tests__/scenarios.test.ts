import {
  CREATE_WORKSHEET_CHART_MAP_SCENARIO,
  createCliScenarioOracles,
} from '../scenarios';
import {CLI_EVAL_TARGET_TABLE} from '../fixture';

describe('CLI behavioral scenario oracles', () => {
  it('accepts a grounded answer that explicitly says the decoy table was not used', async () => {
    const oracle = createCliScenarioOracles(
      CREATE_WORKSHEET_CHART_MAP_SCENARIO,
    ).find((candidate) => candidate.id === 'grounded-answer');
    if (!oracle) throw new Error('Missing grounded-answer oracle.');

    const result = await oracle.evaluate({
      scenario: CREATE_WORKSHEET_CHART_MAP_SCENARIO,
      finalAnswer:
        'Created a chart and map from analytics.events. archive.events was explicitly not used.',
      errors: [],
      mutations: [],
      metadata: {},
    });

    expect(result.pass).toBe(true);
  });

  it('recognizes a canonical quoted table identity in map dataset state', async () => {
    const oracle = createCliScenarioOracles(
      CREATE_WORKSHEET_CHART_MAP_SCENARIO,
    ).find((candidate) => candidate.id === 'canonical-bindings');
    if (!oracle) throw new Error('Missing canonical-bindings oracle.');

    const result = await oracle.evaluate({
      scenario: CREATE_WORKSHEET_CHART_MAP_SCENARIO,
      workspace: {
        artifacts: {artifactsById: {}},
        worksheets: [
          {
            id: 'worksheet-1',
            blocks: [
              {
                id: 'chart-1',
                type: 'chart',
                tableName: CLI_EVAL_TARGET_TABLE,
              },
            ],
          },
        ],
        maps: [
          {
            id: 'map-1',
            config: {
              datasets: {
                events: {
                  source: {
                    tableName: CLI_EVAL_TARGET_TABLE,
                    transformSql:
                      'SELECT latitude, longitude FROM __sqlrooms_source',
                  },
                },
              },
              spec: {},
            },
          },
        ],
      },
      finalAnswer: '',
      errors: [],
      mutations: [],
      metadata: {},
    });

    expect(result.pass).toBe(true);
  });
});
