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

  it('rejects incidental chart field names outside chart settings', async () => {
    const current = workspace();
    current.documents[0]!.blocks[1]!.config = {
      chartType: 'count-plot',
      settings: {field: 'category', metric: 'count'},
      dataPolicy: {reason: 'metric'},
    } as unknown as (typeof current.documents)[number]['blocks'][number]['config'];
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

  it('requires the document map block to reference the persisted map', async () => {
    const current = workspace();
    current.documents[0]!.blocks[2]!.blockInstanceId = 'other-map';
    const oracle = createCliScenarioOracles(
      CREATE_DOCUMENT_CHART_MAP_SCENARIO,
    ).find((candidate) => candidate.id === 'document-shape');

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
    Object.assign(combinedTitle.documents[0]!.blocks[1]!, {
      caption: 'Metric by category — Source: analytics.events',
    });
    const valid = workspace();
    Object.assign(valid.documents[0]!.blocks[1]!, {
      caption: 'Metric by category',
    });
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

  it('accepts production chart fields and derived point geometry', async () => {
    const current = workspace();
    current.documents[0]!.blocks[1]!.config = {
      chartType: 'count-plot',
      settings: {
        field: 'category',
        metric: 'aggregate',
        valueField: 'metric',
        aggregate: 'sum',
      },
    } as unknown as (typeof current.documents)[number]['blocks'][number]['config'];
    current.maps[0]!.config.datasets = {
      events: {
        source: {
          tableName: 'analytics.events',
          transformSql:
            'SELECT *, ST_AsWKB(ST_Point("longitude", "latitude")) AS "geom" FROM __sqlrooms_source WHERE "longitude" IS NOT NULL AND "latitude" IS NOT NULL',
        },
        geometryColumn: 'geom',
        geometryEncodingHint: 'wkb',
      },
    } as (typeof current.maps)[0]['config']['datasets'];
    current.maps[0]!.config.spec.layers[0]!._sqlroomsBinding = {
      dataset: 'events',
      geometryColumn: 'geom',
    } as unknown as (typeof current.maps)[0]['config']['spec']['layers'][number]['_sqlroomsBinding'];
    Object.assign(current.maps[0]!.config.spec.layers[0]!, {
      '@@type': 'GeoArrowScatterplotLayer',
    });
    current.maps[0]!.config.fitToData = {
      dataset: 'events',
      longitudeColumn: 'longitude',
      latitudeColumn: 'latitude',
    } as unknown as (typeof current.maps)[0]['config']['fitToData'];
    const oracle = createCliScenarioOracles(
      CREATE_DOCUMENT_CHART_MAP_SCENARIO,
    ).find((candidate) => candidate.id === 'canonical-bindings');
    if (!oracle) throw new Error('Missing canonical-bindings oracle.');

    const evaluate = () =>
      oracle.evaluate(context(CREATE_DOCUMENT_CHART_MAP_SCENARIO, current));
    const dataset = current.maps[0]!.config.datasets.events! as unknown as {
      geometryEncodingHint?: string;
      source: {transformSql: string};
    };
    const layer = current.maps[0]!.config.spec.layers[0]! as unknown as {
      '@@type': string;
      _sqlroomsBinding: {geometryColumn?: string};
    };
    const validTransformSql = dataset.source.transformSql;

    expect(await evaluate()).toMatchObject({pass: true});

    delete dataset.geometryEncodingHint;
    expect(await evaluate()).toMatchObject({pass: true});
    dataset.geometryEncodingHint = 'wkb';

    delete layer._sqlroomsBinding.geometryColumn;
    expect(await evaluate()).toMatchObject({pass: true});
    layer._sqlroomsBinding.geometryColumn = 'geom';

    layer['@@type'] = 'GeoJsonLayer';
    expect(await evaluate()).toMatchObject({pass: true});
    layer['@@type'] = 'GeoArrowScatterplotLayer';

    current.documents[0]!.blocks[1]!.config = {
      chartType: 'box-plot',
      settings: {x: 'category', y: 'metric'},
    } as unknown as (typeof current.documents)[number]['blocks'][number]['config'];
    expect(await evaluate()).toMatchObject({pass: true});

    dataset.source.transformSql = ` ${validTransformSql}; `;
    expect(await evaluate()).toMatchObject({pass: true});

    dataset.source.transformSql =
      'SELECT *, ST_AsWKB(ST_Point(longitude, latitude)) AS geom FROM __sqlrooms_source';
    expect(await evaluate()).toMatchObject({pass: false});

    dataset.source.transformSql = validTransformSql.replace(
      'ST_Point("longitude", "latitude")',
      'ST_Point("x", "y")',
    );
    expect(await evaluate()).toMatchObject({pass: false});

    dataset.source.transformSql = validTransformSql;
    dataset.geometryEncodingHint = 'wkt';
    expect(await evaluate()).toMatchObject({pass: false});

    dataset.geometryEncodingHint = 'wkb';
    layer['@@type'] = 'GeoArrowPolygonLayer';
    expect(await evaluate()).toMatchObject({pass: false});
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
