import {
  createAnswerGroundingOracle,
  createErrorOracle,
  createWorkspaceStateOracle,
  defineScenario,
  type BehavioralOracle,
  type JsonValue,
  type ScenarioDefinition,
} from '@sqlrooms/evals';
import {CLI_EVAL_TARGET_TABLE} from './fixture';

const CLI_EVAL_DECOY_TABLES = new Set(['archive.events', '"archive"."events"']);

type WorkspaceSnapshot = {
  artifacts: {artifactsById: Record<string, {type: string}>};
  worksheets: Array<{
    id: string;
    blocks: Array<{
      id: string;
      type: string;
      tableName?: string;
      blockType?: string;
      blockInstanceId?: string;
      caption?: string;
      text?: unknown;
      config?: unknown;
    }>;
  }>;
  maps: Array<{
    id: string;
    config: {datasets: Record<string, unknown>; spec: unknown};
  }>;
};

function snapshot(value: JsonValue | undefined): WorkspaceSnapshot {
  return value as unknown as WorkspaceSnapshot;
}

function asJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function hasObjectShape(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function object(value: unknown): Record<string, unknown> | undefined {
  return hasObjectShape(value) ? (value as Record<string, unknown>) : undefined;
}

function hasFieldBinding(value: unknown, field: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasFieldBinding(item, field));
  }
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    record.field === field ||
    Object.values(record).some((item) => hasFieldBinding(item, field))
  );
}

function hasCanonicalMapBinding(
  map: WorkspaceSnapshot['maps'][number] | undefined,
): boolean {
  if (!map) return false;
  const spec = object(map.config.spec);
  const layers = Array.isArray(spec?.layers) ? spec.layers : [];
  const activeLayers = layers.filter(
    (layer) => object(layer)?.visible !== false,
  );
  const fitToData = object((map.config as {fitToData?: unknown}).fitToData);
  const fitDataset = fitToData?.dataset;
  const fitMatches =
    typeof fitDataset === 'string' &&
    fitToData?.longitudeColumn === 'longitude' &&
    fitToData?.latitudeColumn === 'latitude';
  if (!fitMatches || activeLayers.length === 0) return false;

  return activeLayers.every((layer) => {
    const binding = object(object(layer)?._sqlroomsBinding);
    const dataset = binding?.dataset;
    if (typeof dataset !== 'string' || dataset !== fitDataset) return false;
    const source = object(object(map.config.datasets[dataset])?.source);
    return (
      source?.tableName === CLI_EVAL_TARGET_TABLE &&
      binding?.longitudeColumn === 'longitude' &&
      binding?.latitudeColumn === 'latitude'
    );
  });
}

/** Pinned production-model scenario that starts from an empty workspace. */
export const CREATE_WORKSHEET_CHART_MAP_SCENARIO = defineScenario({
  id: 'worksheet.create-chart-map',
  version: 1,
  title: 'Create a worksheet with a chart and map',
  description:
    'Creates one worksheet from ambiguous tables and materializes chart/map state.',
  compatibleProfiles: ['worksheet-charts-maps'],
  fixture: {database: 'ambiguous-geospatial-v1', workspace: 'empty'},
  turns: [
    {
      id: 'create',
      input:
        'Create exactly one new Worksheet named Event analysis. In it, add a quantitative chart of metric by category and a geographic point map using latitude and longitude from analytics.events. Do not use archive.events and do not create a dashboard or a second worksheet. Summarize exactly what you created and which table you used.',
    },
  ],
  expectations: [
    {
      oracleId: 'worksheet-shape',
      description: 'Exactly one worksheet contains one chart and one map.',
    },
    {
      oracleId: 'canonical-bindings',
      description:
        'Both visualizations use analytics.events and expected fields.',
    },
    {
      oracleId: 'artifact-policy',
      description: 'No dashboard or second worksheet is created.',
    },
    {
      oracleId: 'grounded-answer',
      description: 'The answer names the actual table and visualizations.',
    },
    {oracleId: 'no-errors', description: 'The target records no errors.'},
  ],
  metadata: {suite: 'nightly', owner: 'sqlrooms'},
});

/** Pinned production-model scenario that mutates an existing worksheet. */
export const MUTATE_WORKSHEET_SCENARIO = defineScenario({
  id: 'worksheet.mutate-chart-map',
  version: 1,
  title: 'Mutate an existing worksheet in place',
  description:
    'Changes one seeded chart and adds a note while preserving the seeded map.',
  compatibleProfiles: ['worksheet-charts-maps'],
  fixture: {
    database: 'ambiguous-geospatial-v1',
    workspace: 'worksheet-chart-map',
  },
  turns: [
    {
      id: 'mutate',
      input:
        'In the current Worksheet, update the existing chart in place so its title is "Metric by category", then add one short paragraph saying "Source: analytics.events". Preserve the existing map and heading exactly. Do not create another chart, map, worksheet, or dashboard. Report only changes that actually succeeded.',
    },
  ],
  expectations: [
    {
      oracleId: 'mutated-in-place',
      description: 'The seeded chart is updated and one source note is added.',
    },
    {
      oracleId: 'unrelated-state-preserved',
      description: 'The seeded heading and map remain unchanged.',
    },
    {
      oracleId: 'no-stray-artifacts',
      description: 'No duplicate artifact or visualization is created.',
    },
    {
      oracleId: 'grounded-answer',
      description: 'The answer reports the requested successful mutation.',
    },
    {oracleId: 'no-errors', description: 'The target records no errors.'},
  ],
  metadata: {suite: 'nightly', owner: 'sqlrooms'},
});

/** Non-blocking continuity smoke using two turns and one run context. */
export const MULTI_TURN_WORKSHEET_SCENARIO = defineScenario({
  id: 'worksheet.multi-turn-continuity',
  version: 1,
  title: 'Create and then modify one worksheet',
  compatibleProfiles: ['worksheet-charts-maps'],
  fixture: {database: 'ambiguous-geospatial-v1', workspace: 'empty'},
  turns: [
    {
      id: 'create',
      input:
        'Create one Worksheet named Continuity and add a chart of metric by category from analytics.events.',
    },
    {
      id: 'modify',
      input:
        'In that same Worksheet, add a map of latitude and longitude from analytics.events. Do not create another artifact.',
    },
  ],
  expectations: [
    {
      oracleId: 'worksheet-shape',
      description: 'One worksheet contains both requested visualizations.',
    },
    {
      oracleId: 'artifact-policy',
      description: 'The follow-up reuses the first-turn worksheet.',
    },
    {oracleId: 'no-errors', description: 'The target records no errors.'},
  ],
  metadata: {suite: 'smoke', owner: 'sqlrooms'},
});

/** Stable scenarios run by the nightly production-model canary. */
export const CLI_BEHAVIORAL_SCENARIOS: readonly ScenarioDefinition[] = [
  CREATE_WORKSHEET_CHART_MAP_SCENARIO,
  MUTATE_WORKSHEET_SCENARIO,
];

function chartAndMap(workspace: WorkspaceSnapshot) {
  const [worksheet] = workspace.worksheets;
  return {
    worksheet,
    charts: worksheet?.blocks.filter((block) => block.type === 'chart') ?? [],
    mapBlocks:
      worksheet?.blocks.filter(
        (block) => block.type === 'statefulBlock' && block.blockType === 'map',
      ) ?? [],
  };
}

function mapDatasetTableNames(workspace: WorkspaceSnapshot): string[] {
  return workspace.maps.flatMap((map) =>
    Object.values(map.config.datasets).flatMap((dataset) => {
      if (!hasObjectShape(dataset)) return [];
      const source = dataset.source;
      if (!hasObjectShape(source) || typeof source.tableName !== 'string') {
        return [];
      }
      return [source.tableName];
    }),
  );
}

/** Deterministic state and policy oracles for a pinned CLI scenario. */
export function createCliScenarioOracles(
  scenario: ScenarioDefinition,
): readonly BehavioralOracle[] {
  const byId: Record<string, BehavioralOracle> = {
    'worksheet-shape': createWorkspaceStateOracle({
      id: 'worksheet-shape',
      evaluate: (value) => {
        const workspace = snapshot(value);
        const {charts, mapBlocks} = chartAndMap(workspace);
        const pass =
          workspace.worksheets.length === 1 &&
          charts.length === 1 &&
          mapBlocks.length === 1 &&
          workspace.maps.length === 1 &&
          hasObjectShape(charts[0]?.config) &&
          hasObjectShape(workspace.maps[0]?.config.spec);
        return {
          pass,
          reason: pass
            ? 'One worksheet contains structurally valid chart and map state.'
            : 'Expected one worksheet with durable chart and map state.',
          evidence: {
            worksheetCount: workspace.worksheets.length,
            chartCount: charts.length,
            mapBlockCount: mapBlocks.length,
            mapCount: workspace.maps.length,
          },
        };
      },
    }),
    'canonical-bindings': createWorkspaceStateOracle({
      id: 'canonical-bindings',
      evaluate: (value) => {
        const workspace = snapshot(value);
        const {charts} = chartAndMap(workspace);
        const mapTables = mapDatasetTableNames(workspace);
        const pass =
          charts.some(
            (chart) =>
              chart.tableName === CLI_EVAL_TARGET_TABLE &&
              hasFieldBinding(chart.config, 'category') &&
              hasFieldBinding(chart.config, 'metric'),
          ) &&
          workspace.maps.some(hasCanonicalMapBinding) &&
          !mapTables.some((tableName) => CLI_EVAL_DECOY_TABLES.has(tableName));
        return {
          pass,
          reason: pass
            ? 'Chart and map use the intended canonical geospatial table.'
            : 'A visualization has an unexpected table or missing field binding.',
          evidence: {
            chartTables: charts.map((chart) => chart.tableName ?? null),
            chartConfigs: asJson(charts.map((chart) => chart.config ?? null)),
            mapTables,
            maps: asJson(workspace.maps),
          },
        };
      },
    }),
    'artifact-policy': createWorkspaceStateOracle({
      id: 'artifact-policy',
      evaluate: (value) => {
        const workspace = snapshot(value);
        const types = Object.values(workspace.artifacts.artifactsById).map(
          (artifact) => artifact.type,
        );
        const pass =
          workspace.worksheets.length === 1 &&
          types.filter((type) => type === 'worksheet').length === 1 &&
          !types.includes('dashboard');
        return {
          pass,
          reason: pass
            ? 'Only the intended worksheet artifact exists.'
            : 'A duplicate worksheet or disallowed dashboard was created.',
          evidence: {artifactTypes: types},
        };
      },
    }),
    'mutated-in-place': createWorkspaceStateOracle({
      id: 'mutated-in-place',
      evaluate: (value) => {
        const workspace = snapshot(value);
        const {worksheet, charts} = chartAndMap(workspace);
        const chartConfig = hasObjectShape(charts[0]?.config)
          ? (charts[0]!.config as Record<string, unknown>)
          : {};
        const sourceNote = worksheet?.blocks.find(
          (block) =>
            block.type === 'paragraph' &&
            JSON.stringify(block.text ?? null).includes(
              'Source: analytics.events',
            ),
        );
        const pass =
          charts.length === 1 &&
          charts[0]?.id === 'seed-chart' &&
          chartConfig.title === 'Metric by category' &&
          Boolean(sourceNote);
        return {
          pass,
          reason: pass
            ? 'The seeded chart was updated in place and the source note was added.'
            : 'The requested in-place chart/note mutation is incomplete.',
          evidence: {
            chartTitle:
              typeof chartConfig.title === 'string' ? chartConfig.title : null,
            sourceNote: asJson(sourceNote ?? null),
            blocks: asJson(worksheet?.blocks ?? []),
          },
        };
      },
    }),
    'unrelated-state-preserved': createWorkspaceStateOracle({
      id: 'unrelated-state-preserved',
      evaluate: (value, context) => {
        const workspace = snapshot(value);
        const initial = snapshot(
          (context.metadata.initialState as JsonValue | undefined) ?? undefined,
        );
        const heading = workspace.worksheets[0]?.blocks.find(
          (block) => block.id === 'seed-heading',
        );
        const initialHeading = initial.worksheets[0]?.blocks.find(
          (block) => block.id === 'seed-heading',
        );
        const map = workspace.maps.find((candidate) =>
          candidate.id.endsWith('-map'),
        );
        const initialMap = initial.maps.find((candidate) =>
          candidate.id.endsWith('-map'),
        );
        const mapBlock = workspace.worksheets[0]?.blocks.find(
          (block) => block.id === 'seed-map-block',
        );
        const initialMapBlock = initial.worksheets[0]?.blocks.find(
          (block) => block.id === 'seed-map-block',
        );
        const pass =
          Boolean(heading) &&
          JSON.stringify(heading) === JSON.stringify(initialHeading) &&
          Boolean(mapBlock) &&
          JSON.stringify(mapBlock) === JSON.stringify(initialMapBlock) &&
          Boolean(map) &&
          JSON.stringify(map) === JSON.stringify(initialMap);
        return {
          pass,
          reason: pass
            ? 'The seeded heading and map were preserved.'
            : 'Unrelated seeded state changed.',
          evidence: {
            heading: asJson(heading ?? null),
            mapBlock: asJson(mapBlock ?? null),
            map: asJson(map ?? null),
          },
        };
      },
    }),
    'no-stray-artifacts': createWorkspaceStateOracle({
      id: 'no-stray-artifacts',
      evaluate: (value) => {
        const workspace = snapshot(value);
        const {charts, mapBlocks} = chartAndMap(workspace);
        const pass =
          workspace.worksheets.length === 1 &&
          charts.length === 1 &&
          mapBlocks.length === 1 &&
          workspace.maps.length === 1;
        return {
          pass,
          reason: pass
            ? 'No stray artifact or visualization was created.'
            : 'The mutation created duplicate or stray durable state.',
          evidence: {
            worksheetCount: workspace.worksheets.length,
            chartCount: charts.length,
            mapBlockCount: mapBlocks.length,
            mapCount: workspace.maps.length,
          },
        };
      },
    }),
    'grounded-answer': createAnswerGroundingOracle({
      id: 'grounded-answer',
      evaluate: (answer) => {
        const normalized = answer.toLowerCase();
        const mutationScenario = scenario.id.includes('mutate');
        const pass = mutationScenario
          ? normalized.includes('metric by category') &&
            normalized.includes('analytics.events')
          : normalized.includes('analytics.events') &&
            normalized.includes('chart') &&
            normalized.includes('map');
        return {
          pass,
          reason: pass
            ? 'The final answer describes the durable result and intended table.'
            : 'The final answer omits the requested durable result or intended table.',
          evidence: {answer},
        };
      },
    }),
    'no-errors': createErrorOracle({
      id: 'no-errors',
      evaluate: (errors) => ({
        pass: errors.length === 0,
        reason:
          errors.length === 0
            ? 'No target or provider errors were recorded.'
            : `${errors.length} target or provider error(s) were recorded.`,
        evidence: {errors: asJson(errors)},
      }),
    }),
  };

  return scenario.expectations.map((expectation) => {
    const oracle = byId[expectation.oracleId];
    if (!oracle) {
      throw new Error(
        `Scenario ${scenario.id} references unknown oracle ${expectation.oracleId}.`,
      );
    }
    return oracle;
  });
}
