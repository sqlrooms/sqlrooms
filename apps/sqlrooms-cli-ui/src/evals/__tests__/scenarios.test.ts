import {describe, expect, it} from '@jest/globals';
import type {JsonValue, OracleContext} from '@sqlrooms/evals';
import {
  CREATE_WORKSHEET_CHART_MAP_SCENARIO,
  MUTATE_WORKSHEET_SCENARIO,
  createCliScenarioOracles,
} from '../scenarios';

function workspace() {
  return {
    artifacts: {artifactsById: {worksheet: {type: 'worksheet'}}},
    worksheets: [
      {
        id: 'worksheet',
        blocks: [
          {
            id: 'seed-heading',
            type: 'heading',
            level: 2,
            text: [{type: 'text', text: 'Existing analysis'}],
          },
          {
            id: 'seed-chart',
            type: 'chart',
            tableName: '"analytics"."events"',
            config: {
              chartType: 'bar',
              x: {field: 'category'},
              y: {field: 'metric', aggregate: 'sum'},
            },
          },
          {
            id: 'seed-map-block',
            type: 'statefulBlock',
            blockType: 'map',
            blockInstanceId: 'worksheet-map',
          },
        ],
      },
    ],
    maps: [
      {
        id: 'worksheet-map',
        config: {
          datasets: {
            events: {source: {tableName: '"analytics"."events"'}},
          },
          spec: {
            layers: [
              {
                _sqlroomsBinding: {
                  longitudeColumn: 'longitude',
                  latitudeColumn: 'latitude',
                },
              },
            ],
          },
        },
      },
    ],
  };
}

function context(
  scenario: OracleContext['scenario'],
  current: ReturnType<typeof workspace>,
  initial = current,
): OracleContext {
  return {
    scenario,
    workspace: current as unknown as JsonValue,
    finalAnswer: '',
    errors: [],
    mutations: [],
    metadata: {initialState: initial as unknown as JsonValue},
  };
}

describe('CLI behavioral scenario oracles', () => {
  it('rejects a chart that uses the right table with the wrong fields', async () => {
    const current = workspace();
    current.worksheets[0]!.blocks[1]!.config = {
      chartType: 'bar',
      x: {field: 'wrong-category'},
      y: {field: 'wrong-metric', aggregate: 'sum'},
    };
    const oracle = createCliScenarioOracles(
      CREATE_WORKSHEET_CHART_MAP_SCENARIO,
    ).find((candidate) => candidate.id === 'canonical-bindings');

    expect(
      await oracle?.evaluate(
        context(CREATE_WORKSHEET_CHART_MAP_SCENARIO, current),
      ),
    ).toMatchObject({pass: false});
  });

  it('requires the seeded heading to remain byte-for-byte unchanged', async () => {
    const initial = workspace();
    const unchanged = workspace();
    const changed = workspace();
    changed.worksheets[0]!.blocks[0]!.text = [
      {type: 'text', text: 'Changed analysis'},
    ];
    const oracle = createCliScenarioOracles(MUTATE_WORKSHEET_SCENARIO).find(
      (candidate) => candidate.id === 'unrelated-state-preserved',
    );

    expect(
      await oracle?.evaluate(
        context(MUTATE_WORKSHEET_SCENARIO, unchanged, initial),
      ),
    ).toMatchObject({pass: true});
    expect(
      await oracle?.evaluate(
        context(MUTATE_WORKSHEET_SCENARIO, changed, initial),
      ),
    ).toMatchObject({pass: false});
  });
});
