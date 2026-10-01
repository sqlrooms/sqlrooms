import {createDeckTableDatasetSql} from './datasets/tableDatasetSql';
import {
  createDescribeDatasetSql,
  isDuckDbNativeGeometryType,
} from './datasets/wrapGeometryAsWkb';
import type {DeckMapConfig} from './mapConfig';

const FLAT_FILL = [56, 189, 248, 180] as const;
const COLOR_PROPS = [
  'getFillColor',
  'getLineColor',
  'getColor',
  'getSourceColor',
  'getTargetColor',
] as const;
const SKIP_COLUMN =
  /^(geom|geometry|wkb|wkt|lat|latitude|lon|lng|longitude|h3|h3_cell|hex|id|fid|ogc_fid|index|uuid)$|(_id|_h3|_geom|_lat|_lon)$|^h3_/i;

export type VisualQueryTable = {
  numRows: number;
  getChild(name: string): {get(index: number): unknown} | null;
};
export type VisualColumn = {name: string; type: string};
type Span = {min: unknown; max: unknown};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

function isNumericType(type: string): boolean {
  const normalized = type.trim().toLowerCase();
  return (
    !normalized.includes('[]') &&
    !isDuckDbNativeGeometryType(normalized) &&
    /int|float|double|decimal|real|numeric|hugeint/.test(normalized)
  );
}

const isTextType = (type: string) =>
  /varchar|char|string|text|^enum/i.test(type.trim());

/** True when min and max are the same value, including an all-null column. */
export function isConstantFieldSpan(span: Span | undefined): boolean {
  if (!span) return false;
  const {min, max} = span;
  if (min == null && max == null) return true;
  if (min == null || max == null) return false;
  return typeof min === 'number' && typeof max === 'number'
    ? min === max
    : String(min) === String(max);
}

/** `SELECT min/max` for the candidate columns of one dataset query. */
export function buildVisualFieldRangeSql(
  sourceSql: string,
  columns: readonly string[],
): string {
  const selects = columns.map((name, index) => {
    const quoted = quoteIdent(name);
    return `min(${quoted}) AS "__vf${index}_min", max(${quoted}) AS "__vf${index}_max"`;
  });
  const cleaned = sourceSql.trim().replace(/(?:\s*;+\s*)+$/, '');
  return `SELECT ${selects.join(', ')} FROM (${cleaned}) AS "__sqlrooms_visual_fields"`;
}

function fieldOf(value: unknown, color: boolean): string | undefined {
  if (!color && typeof value === 'string' && value.startsWith('@@=')) {
    return value.slice(3).trim() || undefined;
  }
  if (!isRecord(value)) return undefined;
  const fn = value['@@function'] ?? value['@@type'];
  const ok = color
    ? fn === 'colorScale'
    : fn === 'scale' || fn === 'scaleLinear';
  return ok && typeof value.field === 'string' && value.field.trim()
    ? value.field.trim()
    : undefined;
}

function pickColumn(
  columns: readonly VisualColumn[],
  spans: ReadonlyMap<string, Span>,
  numericOnly: boolean,
  exclude: string,
): string | undefined {
  for (const column of columns) {
    if (
      column.name.toLowerCase() === exclude.toLowerCase() ||
      SKIP_COLUMN.test(column.name)
    ) {
      continue;
    }
    const numeric = isNumericType(column.type);
    if (numericOnly ? !numeric : !numeric && !isTextType(column.type)) continue;
    const span = spans.get(column.name.toLowerCase());
    if (span && !isConstantFieldSpan(span)) return column.name;
  }
  return undefined;
}

function datasetIdOf(
  layer: Record<string, unknown>,
  datasetIds: string[],
): string | undefined {
  const binding = isRecord(layer._sqlroomsBinding)
    ? layer._sqlroomsBinding
    : undefined;
  const bound =
    typeof binding?.dataset === 'string' ? binding.dataset.trim() : '';
  return bound || (datasetIds.length === 1 ? datasetIds[0] : undefined);
}

/** Replaces a constant color or elevation column. Flat fill or no elevation when nothing varies. */
export function rewriteConstantVisualFields(
  config: DeckMapConfig,
  columnsByDataset: ReadonlyMap<string, readonly VisualColumn[]>,
  spansByDataset: ReadonlyMap<string, ReadonlyMap<string, Span>>,
): DeckMapConfig {
  const spec = config.spec;
  if (!isRecord(spec) || !Array.isArray(spec.layers)) return config;
  const datasetIds = Object.keys(config.datasets ?? {});
  let changed = false;
  const layers = spec.layers.map((layer) => {
    if (!isRecord(layer)) return layer;
    const id = datasetIdOf(layer, datasetIds);
    const columns = id ? columnsByDataset.get(id) : undefined;
    const spans = id ? spansByDataset.get(id) : undefined;
    if (!columns || !spans) return layer;
    let next = layer;
    for (const prop of COLOR_PROPS) {
      const field = fieldOf(next[prop], true);
      if (!field || !isConstantFieldSpan(spans.get(field.toLowerCase()))) {
        continue;
      }
      const replacement = pickColumn(columns, spans, false, field);
      const accessor = next[prop];
      if (replacement && isRecord(accessor)) {
        const numeric = isNumericType(
          columns.find(
            (column) => column.name.toLowerCase() === replacement.toLowerCase(),
          )?.type ?? '',
        );
        next = {
          ...next,
          [prop]: {
            ...accessor,
            field: replacement,
            type: numeric ? 'sequential' : 'categorical',
            scheme: numeric ? 'Viridis' : 'Tableau10',
          },
        };
      } else if (prop === 'getFillColor' || prop === 'getColor') {
        next = {...next, [prop]: [...FLAT_FILL]};
      } else {
        const {[prop]: _removed, ...rest} = next;
        next = rest;
      }
      changed = true;
    }
    const elevation = fieldOf(next.getElevation, false);
    if (elevation && isConstantFieldSpan(spans.get(elevation.toLowerCase()))) {
      const replacement = pickColumn(columns, spans, true, elevation);
      if (replacement) {
        next = {
          ...next,
          getElevation: {
            '@@function': 'scale',
            field: replacement,
            type: 'linear',
            domain: 'auto',
            range: [0, 200],
          },
        };
      } else {
        const {
          getElevation: _elevation,
          elevationScale: _scale,
          ...rest
        } = next;
        next = rest;
      }
      changed = true;
    }
    return next;
  });
  return changed ? {...config, spec: {...spec, layers}} : config;
}

function datasetSql(source: unknown): string | undefined {
  if (!isRecord(source)) return undefined;
  if (typeof source.tableName === 'string' && source.tableName.trim()) {
    try {
      return createDeckTableDatasetSql({
        tableName: source.tableName,
        transformSql:
          typeof source.transformSql === 'string'
            ? source.transformSql
            : undefined,
      });
    } catch {
      return undefined;
    }
  }
  return typeof source.sqlQuery === 'string' && source.sqlQuery.trim()
    ? source.sqlQuery.trim().replace(/(?:\s*;+\s*)+$/, '')
    : undefined;
}

/** Queries each dataset and rewrites constant color and elevation fields. Failures leave the config unchanged. */
export async function avoidConstantVisualFields(
  config: DeckMapConfig,
  query: (sql: string) => Promise<VisualQueryTable | null>,
): Promise<DeckMapConfig> {
  const datasets = config.datasets;
  const spec = isRecord(config.spec) ? config.spec : undefined;
  if (!datasets || !Array.isArray(spec?.layers)) return config;
  try {
    const columnsByDataset = new Map<string, VisualColumn[]>();
    const spansByDataset = new Map<string, Map<string, Span>>();
    const datasetIds = Object.keys(datasets);
    for (const [datasetId, dataset] of Object.entries(datasets)) {
      const referenced = spec.layers.flatMap((layer) =>
        isRecord(layer) && datasetIdOf(layer, datasetIds) === datasetId
          ? [
              ...COLOR_PROPS.map((prop) => fieldOf(layer[prop], true)),
              fieldOf(layer.getElevation, false),
            ].filter((field): field is string => Boolean(field))
          : [],
      );
      const sql = datasetSql(isRecord(dataset) ? dataset.source : undefined);
      if (!sql || referenced.length === 0) continue;
      const described = await query(createDescribeDatasetSql(sql));
      const names =
        described?.getChild('column_name') ??
        described?.getChild('column_names');
      const types =
        described?.getChild('column_type') ??
        described?.getChild('column_types');
      if (!described || !names || !types) continue;
      const wanted = new Set(referenced.map((field) => field.toLowerCase()));
      const columns: VisualColumn[] = [];
      for (let i = 0; i < described.numRows; i++) {
        const name = names.get(i);
        if (typeof name !== 'string' || !name) continue;
        const typeName =
          typeof types.get(i) === 'string' ? (types.get(i) as string) : '';
        const used = wanted.has(name.toLowerCase());
        if (
          !used &&
          (SKIP_COLUMN.test(name) ||
            (!isNumericType(typeName) && !isTextType(typeName)))
        ) {
          continue;
        }
        columns.push({name, type: typeName});
      }
      if (columns.length === 0) continue;
      const ranges = await query(
        buildVisualFieldRangeSql(
          sql,
          columns.map((column) => column.name),
        ),
      );
      if (!ranges || ranges.numRows < 1) continue;
      const spans = new Map<string, Span>();
      columns.forEach((column, index) => {
        spans.set(column.name.toLowerCase(), {
          min: ranges.getChild(`__vf${index}_min`)?.get(0),
          max: ranges.getChild(`__vf${index}_max`)?.get(0),
        });
      });
      columnsByDataset.set(datasetId, columns);
      spansByDataset.set(datasetId, spans);
    }
    return spansByDataset.size === 0
      ? config
      : rewriteConstantVisualFields(config, columnsByDataset, spansByDataset);
  } catch {
    return config;
  }
}
