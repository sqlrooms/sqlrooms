import {describe, expect, it} from '@jest/globals';
import type {JsonValue, OracleContext} from '@sqlrooms/evals';
import {
  CREATE_DOCUMENT_CHART_MAP_SCENARIO,
  MUTATE_DOCUMENT_SCENARIO,
  createCliScenarioOracles,
} from '../scenarios';

function workspace() {
  return {
    artifacts: {artifactsById: {document: {type: 'document'}}},
    documents: [
      {
        id: 'document',
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
              title: 'Original metric chart',
            },
          },
          {
            id: 'seed-map-block',
            type: 'statefulBlock',
            blockType: 'map',
            blockInstanceId: 'document-map',
          },
        ],
      },
    ],
    maps: [
      {
        id: 'document-map',
        config: {
          datasets: {
            events: {source: {tableName: '"analytics"."events"'}},
          },
          spec: {
            layers: [
              {
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
    current.documents[0]!.blocks[1]!.config = {
      chartType: 'bar',
      x: {field: 'wrong-category'},
      y: {field: 'wrong-metric', aggregate: 'sum'},
      title: 'Original metric chart',
    };
    const oracle = createCliScenarioOracles(
      CREATE_DOCUMENT_CHART_MAP_SCENARIO,
    ).find((candidate) => candidate.id === 'canonical-bindings');

    expect(
      await oracle?.evaluate(
        context(CREATE_DOCUMENT_CHART_MAP_SCENARIO, current),
      ),
    ).toMatchObject({pass: false});
  });

  it('rejects a map whose active layer uses a decoy dataset', async () => {
    const current = workspace();
    Object.assign(current.maps[0]!.config.datasets, {
      archive: {source: {tableName: '"archive"."events"'}},
    });
    current.maps[0]!.config.spec.layers[0]!._sqlroomsBinding.dataset =
      'archive';
    current.maps[0]!.config.fitToData = {
      dataset: 'archive',
      longitudeColumn: 'longitude',
      latitudeColumn: 'latitude',
    };
    const oracle = createCliScenarioOracles(
      CREATE_DOCUMENT_CHART_MAP_SCENARIO,
    ).find((candidate) => candidate.id === 'canonical-bindings');

    expect(
      await oracle?.evaluate(
        context(CREATE_DOCUMENT_CHART_MAP_SCENARIO, current),
      ),
    ).toMatchObject({pass: false});
  });

  it('requires the seeded heading to remain byte-for-byte unchanged', async () => {
    const initial = workspace();
    const unchanged = workspace();
    const changed = workspace();
    changed.documents[0]!.blocks[0]!.text = [
      {type: 'text', text: 'Changed analysis'},
    ];
    const changedMapBlock = workspace();
    changedMapBlock.documents[0]!.blocks[2]!.blockInstanceId = 'other-map';
    const oracle = createCliScenarioOracles(MUTATE_DOCUMENT_SCENARIO).find(
      (candidate) => candidate.id === 'unrelated-state-preserved',
    );

    expect(
      await oracle?.evaluate(
        context(MUTATE_DOCUMENT_SCENARIO, unchanged, initial),
      ),
    ).toMatchObject({pass: true});
    expect(
      await oracle?.evaluate(
        context(MUTATE_DOCUMENT_SCENARIO, changed, initial),
      ),
    ).toMatchObject({pass: false});
    expect(
      await oracle?.evaluate(
        context(MUTATE_DOCUMENT_SCENARIO, changedMapBlock, initial),
      ),
    ).toMatchObject({pass: false});
  });

  it('requires an exact chart title and a distinct source paragraph', async () => {
    const combinedTitle = workspace();
    combinedTitle.documents[0]!.blocks[1]!.config!.title =
      'Metric by category — Source: analytics.events';
    const valid = workspace();
    valid.documents[0]!.blocks[1]!.config!.title = 'Metric by category';
    valid.documents[0]!.blocks.push({
      id: 'source-note',
      type: 'paragraph',
      text: [{type: 'text', text: 'Source: analytics.events'}],
    } as (typeof valid.documents)[number]['blocks'][number]);
    const oracle = createCliScenarioOracles(MUTATE_DOCUMENT_SCENARIO).find(
      (candidate) => candidate.id === 'mutated-in-place',
    );

    expect(
      await oracle?.evaluate(context(MUTATE_DOCUMENT_SCENARIO, combinedTitle)),
    ).toMatchObject({pass: false});
    expect(
      await oracle?.evaluate(context(MUTATE_DOCUMENT_SCENARIO, valid)),
    ).toMatchObject({pass: true});
  });

  it('requires the grounded answer to name the intended chart and map result', async () => {
    const oracle = createCliScenarioOracles(
      CREATE_DOCUMENT_CHART_MAP_SCENARIO,
    ).find((candidate) => candidate.id === 'grounded-answer');
    if (!oracle) throw new Error('Missing grounded-answer oracle.');

    const evaluate = (finalAnswer: string) =>
      oracle.evaluate({
        scenario: CREATE_DOCUMENT_CHART_MAP_SCENARIO,
        finalAnswer,
        errors: [],
        mutations: [],
        metadata: {},
      });

    expect(
      await evaluate('Created a chart and map from analytics.events.'),
    ).toMatchObject({pass: true});
    expect(
      await evaluate('Created a chart from analytics.events.'),
    ).toMatchObject({pass: false});
  });

  it('recognizes a canonical quoted table identity in map dataset state', async () => {
    const current = workspace();
    const oracle = createCliScenarioOracles(
      CREATE_DOCUMENT_CHART_MAP_SCENARIO,
    ).find((candidate) => candidate.id === 'canonical-bindings');
    if (!oracle) throw new Error('Missing canonical-bindings oracle.');

    const result = await oracle.evaluate(
      context(CREATE_DOCUMENT_CHART_MAP_SCENARIO, current),
    );

    expect(result.pass).toBe(true);
  });
});
