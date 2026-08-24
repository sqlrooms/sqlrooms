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

const CLI_EVAL_TARGET_TABLES = new Set([
  'analytics.events',
  CLI_EVAL_TARGET_TABLE,
]);
const CLI_EVAL_DECOY_TABLES = new Set(['archive.events', '"archive"."events"']);
const POINT_LAYER_TYPES = new Set([
  'GeoArrowScatterplotLayer',
  'GeoArrowHeatmapLayer',
  'GeoArrowColumnLayer',
]);

type WorkspaceSnapshot = {
  artifacts: {artifactsById: Record<string, {type: string}>};
  documents: Array<{
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

function hasCanonicalChartBinding(value: unknown): boolean {
  const config = object(value);
  const settings = object(config?.settings);
  switch (config?.chartType) {
    case 'count-plot':
      return (
        settings?.field === 'category' &&
        settings.metric === 'aggregate' &&
        settings.valueField === 'metric' &&
        typeof settings.aggregate === 'string'
      );
    case 'box-plot':
      return settings?.x === 'category' && settings.y === 'metric';
    case 'bar':
      return (
        object(config.x)?.field === 'category' &&
        object(config.y)?.field === 'metric'
      );
    default:
      return false;
  }
}

function sqlIdentifierName(expression: string): string | undefined {
  const parts = expression.split('.').map((part) => part.trim());
  const identifiers = parts.map((part) => {
    const quoted = /^"((?:[^"]|"")+)"$/.exec(part);
    if (quoted) return quoted[1]!.replace(/""/g, '"');
    return /^[a-z_][a-z0-9_$]*$/i.test(part) ? part : undefined;
  });
  if (identifiers.some((identifier) => identifier === undefined)) {
    return undefined;
  }
  return identifiers[identifiers.length - 1]?.toLowerCase();
}

function maskSqlCommentsAndLiterals(sql: string): string {
  const masked = sql.split('');
  const mask = (index: number) => {
    if (masked[index] !== '\n' && masked[index] !== '\r') masked[index] = ' ';
  };

  for (let index = 0; index < sql.length; index += 1) {
    if (sql[index] === "'") {
      mask(index);
      while (++index < sql.length) {
        mask(index);
        if (sql[index] === '\\') {
          if (++index < sql.length) mask(index);
        } else if (sql[index] === "'") {
          if (sql[index + 1] !== "'") break;
          if (++index < sql.length) mask(index);
        }
      }
    } else if (sql[index] === '"') {
      while (++index < sql.length && sql[index] !== '"') {}
      while (sql[index + 1] === '"') {
        index += 1;
        while (++index < sql.length && sql[index] !== '"') {}
      }
    } else if (sql[index] === '-' && sql[index + 1] === '-') {
      while (index < sql.length && sql[index] !== '\n') mask(index++);
    } else if (sql[index] === '/' && sql[index + 1] === '*') {
      let depth = 1;
      mask(index);
      mask(++index);
      while (++index < sql.length && depth > 0) {
        if (sql[index] === '/' && sql[index + 1] === '*') {
          depth += 1;
          mask(index);
          mask(++index);
        } else if (sql[index] === '*' && sql[index + 1] === '/') {
          depth -= 1;
          mask(index);
          mask(++index);
        } else {
          mask(index);
        }
      }
    } else if (sql[index] === '$') {
      const delimiter = /^\$[a-z_][a-z0-9_]*\$|^\$\$/i.exec(
        sql.slice(index),
      )?.[0];
      if (!delimiter) continue;
      const end = sql.indexOf(delimiter, index + delimiter.length);
      const endIndex = end < 0 ? sql.length - 1 : end + delimiter.length - 1;
      while (index <= endIndex) mask(index++);
      index -= 1;
    }
  }

  return masked.join('');
}

function hasPointGeometryBinding(
  transformSql: string,
  geometryColumn: string,
): boolean {
  const pointCalls = maskSqlCommentsAndLiterals(transformSql).matchAll(
    /\bst_aswkb\s*\(\s*st_point\s*\(\s*([^(),]+?)\s*,\s*([^(),]+?)\s*\)\s*\)\s+as\s+("(?:[^"]|"")+"|[a-z_][a-z0-9_$]*)/gi,
  );
  return Array.from(pointCalls).some(
    ([, longitude, latitude, alias]) =>
      sqlIdentifierName(longitude!) === 'longitude' &&
      sqlIdentifierName(latitude!) === 'latitude' &&
      sqlIdentifierName(alias!) === geometryColumn.toLowerCase(),
  );
}

function usesOnlyTargetTransformSource(transformSql: string): boolean {
  const sourceReferences = maskSqlCommentsAndLiterals(transformSql).matchAll(
    /\b(?:from|join)\s+((?:"(?:[^"]|"")+"|[a-z_][a-z0-9_$]*)(?:\s*\.\s*(?:"(?:[^"]|"")+"|[a-z_][a-z0-9_$]*)){0,2})/gi,
  );
  const names = Array.from(sourceReferences, ([, reference]) =>
    sqlIdentifierName(reference!),
  );
  return (
    names.length > 0 && names.every((name) => name === '__sqlrooms_source')
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
  const fitMatches = typeof fitDataset === 'string' && activeLayers.length > 0;
  if (!fitMatches) return false;

  return activeLayers.every((layer) => {
    const layerConfig = object(layer);
    const binding = object(layerConfig?._sqlroomsBinding);
    const dataset = binding?.dataset;
    if (typeof dataset !== 'string' || dataset !== fitDataset) return false;
    const datasetConfig = object(map.config.datasets[dataset]);
    const source = object(datasetConfig?.source);
    if (
      typeof source?.tableName !== 'string' ||
      !CLI_EVAL_TARGET_TABLES.has(source.tableName)
    ) {
      return false;
    }

    const transformSql = source.transformSql;
    const datasetGeometryColumn = datasetConfig?.geometryColumn;
    const usesDerivedGeometry =
      typeof transformSql === 'string' ||
      typeof datasetGeometryColumn === 'string';
    const usesDirectCoordinates =
      !usesDerivedGeometry &&
      binding?.longitudeColumn === 'longitude' &&
      binding?.latitudeColumn === 'latitude' &&
      fitToData?.longitudeColumn === 'longitude' &&
      fitToData?.latitudeColumn === 'latitude';
    if (usesDirectCoordinates) return true;

    const layerGeometryColumn = binding?.geometryColumn;
    const layerGeometryMatches =
      layerGeometryColumn === undefined ||
      layerGeometryColumn === datasetGeometryColumn;
    const fitGeometryMatches =
      fitToData?.geometryColumn === datasetGeometryColumn;
    const fitCoordinateMatches =
      fitToData?.longitudeColumn === 'longitude' &&
      fitToData?.latitudeColumn === 'latitude';
    const encodingHint = datasetConfig?.geometryEncodingHint;
    return (
      typeof datasetGeometryColumn === 'string' &&
      layerGeometryMatches &&
      (fitGeometryMatches || fitCoordinateMatches) &&
      typeof layerConfig?.['@@type'] === 'string' &&
      POINT_LAYER_TYPES.has(layerConfig['@@type']) &&
      (encodingHint === undefined || encodingHint === 'wkb') &&
      typeof transformSql === 'string' &&
      hasPointGeometryBinding(transformSql, datasetGeometryColumn) &&
      usesOnlyTargetTransformSource(transformSql)
    );
  });
}

/** Pinned production-model scenario that starts from an empty workspace. */
export const CREATE_DOCUMENT_CHART_MAP_SCENARIO = defineScenario({
  id: 'document.create-chart-map',
  version: 1,
  title: 'Create a document with a chart and map',
  description:
    'Creates one document from ambiguous tables and materializes chart/map state.',
  compatibleProfiles: ['document-charts-maps'],
  fixture: {database: 'ambiguous-geospatial-v1', workspace: 'empty'},
  turns: [
    {
      id: 'create',
      input:
        'Create exactly one new Document named Event analysis. In it, add a quantitative chart of metric by category and a geographic point map using latitude and longitude from analytics.events. Do not use archive.events and do not create a dashboard or a second document. Summarize exactly what you created and which table you used.',
    },
  ],
  expectations: [
    {
      oracleId: 'document-shape',
      description: 'Exactly one document contains one chart and one map.',
    },
    {
      oracleId: 'canonical-bindings',
      description:
        'Both visualizations use analytics.events and expected fields.',
    },
    {
      oracleId: 'artifact-policy',
      description: 'No dashboard or second document is created.',
    },
    {
      oracleId: 'grounded-answer',
      description: 'The answer names the actual table and visualizations.',
    },
    {oracleId: 'no-errors', description: 'The target records no errors.'},
  ],
  metadata: {suite: 'nightly', owner: 'sqlrooms'},
});

/** Pinned production-model scenario that mutates an existing document. */
export const MUTATE_DOCUMENT_SCENARIO = defineScenario({
  id: 'document.mutate-chart-map',
  version: 1,
  title: 'Mutate an existing document in place',
  description:
    'Changes one seeded chart and adds a note while preserving the seeded map.',
  compatibleProfiles: ['document-charts-maps'],
  fixture: {
    database: 'ambiguous-geospatial-v1',
    workspace: 'document-chart-map',
  },
  turns: [
    {
      id: 'mutate',
      input:
        'In the current Document, update the existing chart in place so its title is "Metric by category", then add one short paragraph saying "Source: analytics.events". Preserve the existing map and heading exactly. Do not create another chart, map, document, or dashboard. Report only changes that actually succeeded.',
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
export const MULTI_TURN_DOCUMENT_SCENARIO = defineScenario({
  id: 'document.multi-turn-continuity',
  version: 1,
  title: 'Create and then modify one document',
  compatibleProfiles: ['document-charts-maps'],
  fixture: {database: 'ambiguous-geospatial-v1', workspace: 'empty'},
  turns: [
    {
      id: 'create',
      input:
        'Create one Document named Continuity and add a chart of metric by category from analytics.events.',
    },
    {
      id: 'modify',
      input:
        'In that same Document, add a map of latitude and longitude from analytics.events. Do not create another artifact.',
    },
  ],
  expectations: [
    {
      oracleId: 'document-shape',
      description: 'One document contains both requested visualizations.',
    },
    {
      oracleId: 'artifact-policy',
      description: 'The follow-up reuses the first-turn document.',
    },
    {oracleId: 'no-errors', description: 'The target records no errors.'},
  ],
  metadata: {suite: 'smoke', owner: 'sqlrooms'},
});

/** Stable scenarios run by the nightly production-model canary. */
export const CLI_BEHAVIORAL_SCENARIOS: readonly ScenarioDefinition[] = [
  CREATE_DOCUMENT_CHART_MAP_SCENARIO,
  MUTATE_DOCUMENT_SCENARIO,
];

function chartAndMap(workspace: WorkspaceSnapshot) {
  const [document] = workspace.documents;
  return {
    document,
    charts: document?.blocks.filter((block) => block.type === 'chart') ?? [],
    mapBlocks:
      document?.blocks.filter(
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
    'document-shape': createWorkspaceStateOracle({
      id: 'document-shape',
      evaluate: (value) => {
        const workspace = snapshot(value);
        const {charts, mapBlocks} = chartAndMap(workspace);
        const pass =
          workspace.documents.length === 1 &&
          charts.length === 1 &&
          mapBlocks.length === 1 &&
          workspace.maps.length === 1 &&
          mapBlocks[0]?.blockInstanceId === workspace.maps[0]?.id &&
          hasObjectShape(charts[0]?.config) &&
          hasObjectShape(workspace.maps[0]?.config.spec);
        return {
          pass,
          reason: pass
            ? 'One document contains structurally valid chart and map state.'
            : 'Expected one document with durable chart and map state.',
          evidence: {
            documentCount: workspace.documents.length,
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
              typeof chart.tableName === 'string' &&
              CLI_EVAL_TARGET_TABLES.has(chart.tableName) &&
              hasCanonicalChartBinding(chart.config),
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
          workspace.documents.length === 1 &&
          types.filter((type) => type === 'document').length === 1 &&
          !types.includes('dashboard');
        return {
          pass,
          reason: pass
            ? 'Only the intended document artifact exists.'
            : 'A duplicate document or disallowed dashboard was created.',
          evidence: {artifactTypes: types},
        };
      },
    }),
    'mutated-in-place': createWorkspaceStateOracle({
      id: 'mutated-in-place',
      evaluate: (value) => {
        const workspace = snapshot(value);
        const {document, charts} = chartAndMap(workspace);
        const chartConfig = hasObjectShape(charts[0]?.config)
          ? (charts[0]!.config as Record<string, unknown>)
          : {};
        const chartTitle =
          typeof charts[0]?.caption === 'string'
            ? charts[0].caption
            : chartConfig.title;
        const sourceNote = document?.blocks.find(
          (block) =>
            block.type === 'paragraph' &&
            JSON.stringify(block.text ?? null).includes(
              'Source: analytics.events',
            ),
        );
        const pass =
          charts.length === 1 &&
          charts[0]?.id === 'seed-chart' &&
          chartTitle === 'Metric by category' &&
          Boolean(sourceNote);
        return {
          pass,
          reason: pass
            ? 'The seeded chart was updated in place and the source note was added.'
            : 'The requested in-place chart/note mutation is incomplete.',
          evidence: {
            chartTitle: typeof chartTitle === 'string' ? chartTitle : null,
            sourceNote: asJson(sourceNote ?? null),
            blocks: asJson(document?.blocks ?? []),
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
        const heading = workspace.documents[0]?.blocks.find(
          (block) => block.id === 'seed-heading',
        );
        const initialHeading = initial.documents[0]?.blocks.find(
          (block) => block.id === 'seed-heading',
        );
        const map = workspace.maps.find((candidate) =>
          candidate.id.endsWith('-map'),
        );
        const initialMap = initial.maps.find((candidate) =>
          candidate.id.endsWith('-map'),
        );
        const mapBlock = workspace.documents[0]?.blocks.find(
          (block) => block.id === 'seed-map-block',
        );
        const initialMapBlock = initial.documents[0]?.blocks.find(
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
          workspace.documents.length === 1 &&
          charts.length === 1 &&
          mapBlocks.length === 1 &&
          workspace.maps.length === 1;
        return {
          pass,
          reason: pass
            ? 'No stray artifact or visualization was created.'
            : 'The mutation created duplicate or stray durable state.',
          evidence: {
            documentCount: workspace.documents.length,
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
