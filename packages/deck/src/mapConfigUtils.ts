import {
  getRawSqlTableReference,
  makeQualifiedTableName,
  quoteParsedRawSqlTableReference,
  type DataTable,
  type RawSqlTableReference,
} from '@sqlrooms/duckdb';
import {
  createDeckMapDashboardPanelConfig,
  isDeckMapTableDatasetSource,
  type DeckMapDashboardPanelConfig,
  type DeckMapConfig,
  type DeckMapFitToDataConfig,
} from './mapConfig';
import {
  DECK_TABLE_DATASET_SOURCE_RELATION,
  normalizeDeckTableTransformSql,
} from './datasets/tableDatasetSql';
import type {GeometryEncodingHint} from './prepare/types';
import {getDefaultDeckMapStyle} from './mapStyles';

const LONGITUDE_COLUMN_NAMES = ['longitude', 'lon', 'lng', 'long', 'x'];
const LATITUDE_COLUMN_NAMES = ['latitude', 'lat', 'y'];
const GEOMETRY_COLUMN_NAMES = ['geometry', 'geom'];
const DEFAULT_GEOMETRY_COLUMN = '__sqlrooms_geom';
const DEFAULT_FILL_COLOR = [56, 189, 248, 180] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function updateDeckMapGeometryColumnBindings(
  config: DeckMapDashboardPanelConfig,
  datasetId: string,
  geometryColumn: string | undefined,
) {
  if (!geometryColumn || !isRecord(config.spec)) return config;
  const layers = config.spec.layers;
  if (!Array.isArray(layers)) return config;

  let changed = false;
  const nextLayers = layers.map((layer) => {
    if (!isRecord(layer) || !isRecord(layer._sqlroomsBinding)) return layer;
    const binding = layer._sqlroomsBinding;
    if (
      binding.dataset !== datasetId ||
      typeof binding.geometryColumn !== 'string'
    ) {
      return layer;
    }
    changed = true;
    return {
      ...layer,
      _sqlroomsBinding: {...binding, geometryColumn},
    };
  });

  return changed
    ? {...config, spec: {...config.spec, layers: nextLayers}}
    : config;
}

export type DeckMapConfigColumn = {name: string; type?: string};
export type DeckMapTableReference =
  | string
  | {
      database?: string;
      schema?: string;
      table?: string;
    };
export type DeckMapFillColor =
  | [number, number, number]
  | [number, number, number, number];

function findColumnByName(
  columns: DeckMapConfigColumn[],
  candidates: string[],
) {
  const candidateSet = new Set(candidates);
  return columns.find((column) => candidateSet.has(column.name.toLowerCase()))
    ?.name;
}

function resolveDeckMapCoordinateColumnNames(options: {
  columns: DeckMapConfigColumn[];
  longitudeColumn?: string;
  latitudeColumn?: string;
}) {
  const longitudeColumn =
    options.longitudeColumn ||
    findColumnByName(options.columns, LONGITUDE_COLUMN_NAMES);
  const latitudeColumn =
    options.latitudeColumn ||
    findColumnByName(options.columns, LATITUDE_COLUMN_NAMES);
  return longitudeColumn && latitudeColumn
    ? {longitudeColumn, latitudeColumn}
    : null;
}

export function findDeckMapLongitudeLatitudeColumns(
  columns?: DeckMapConfigColumn[],
) {
  if (!columns) return null;
  return resolveDeckMapCoordinateColumnNames({columns});
}

export function findLongitudeLatitudeColumns(table?: DataTable) {
  if (!table) return null;
  return findDeckMapLongitudeLatitudeColumns(table.columns);
}

function inferGeometryEncodingHint(
  column: DeckMapConfigColumn,
): GeometryEncodingHint | undefined {
  const type = column.type?.toLowerCase();
  if (!type) return undefined;
  if (
    type.includes('wkb') ||
    type.includes('blob') ||
    type.includes('binary')
  ) {
    return 'wkb';
  }
  if (
    type.includes('wkt') ||
    type.includes('varchar') ||
    type.includes('text')
  ) {
    return 'wkt';
  }
  // Native DuckDB GEOMETRY is not an encoding hint — the dataset pipeline
  // projects it through ST_AsWKB via DESCRIBE + SELECT * REPLACE.
  return undefined;
}

export function findDeckMapGeometryColumn(columns?: DeckMapConfigColumn[]) {
  if (!columns) return null;

  const namedGeometryColumn = findColumnByName(columns, GEOMETRY_COLUMN_NAMES);
  const geometryColumn =
    (namedGeometryColumn
      ? columns.find((column) => column.name === namedGeometryColumn)
      : undefined) ??
    columns.find((column) => {
      const type = column.type?.toLowerCase() ?? '';
      return type.includes('geometry') || type.includes('geoarrow');
    });

  if (!geometryColumn) return null;
  return {
    geometryColumn: geometryColumn.name,
    geometryEncodingHint: inferGeometryEncodingHint(geometryColumn),
  };
}

export function findGeometryColumn(table?: DataTable) {
  if (!table) return null;
  return findDeckMapGeometryColumn(table.columns);
}

export function quoteDeckMapSqlIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function quoteDeckMapSqlTableReference(
  tableReference: DeckMapTableReference,
): RawSqlTableReference {
  if (typeof tableReference === 'string') {
    const rawSqlTableReference =
      quoteParsedRawSqlTableReference(tableReference);
    if (!rawSqlTableReference) {
      throw new Error(`Invalid deck map table reference "${tableReference}".`);
    }
    return rawSqlTableReference;
  }
  if (!tableReference.table) {
    throw new Error('Deck map table reference object requires a table name.');
  }
  return getRawSqlTableReference(
    makeQualifiedTableName({
      database: tableReference.database,
      schema: tableReference.schema,
      table: tableReference.table,
    }),
  );
}

function ensureDeckMapColumnExists(
  columns: DeckMapConfigColumn[],
  columnName: string,
  role: string,
) {
  if (!columns.some((column) => column.name === columnName)) {
    throw new Error(
      `Unknown ${role} column "${columnName}". Available columns: ${columns
        .map((column) => column.name)
        .join(', ')}.`,
    );
  }
}

function resolveDeckMapCoordinateColumns(options: {
  columns: DeckMapConfigColumn[];
  longitudeColumn?: string;
  latitudeColumn?: string;
}) {
  const coordinates =
    options.longitudeColumn && options.latitudeColumn
      ? {
          longitudeColumn: options.longitudeColumn,
          latitudeColumn: options.latitudeColumn,
        }
      : findDeckMapLongitudeLatitudeColumns(options.columns);

  if (!coordinates) {
    throw new Error(
      'Could not find longitude/latitude columns. Pass longitudeColumn and latitudeColumn explicitly, or provide geometryColumn.',
    );
  }

  ensureDeckMapColumnExists(
    options.columns,
    coordinates.longitudeColumn,
    'longitude',
  );
  ensureDeckMapColumnExists(
    options.columns,
    coordinates.latitudeColumn,
    'latitude',
  );
  return coordinates;
}

function createDeckMapPointSourceSql(options: {
  sourceSqlQuery?: string;
  tableReference: DeckMapTableReference;
  longitudeColumn: string;
  latitudeColumn: string;
  geometryColumn: string;
}) {
  const quotedLongitude = quoteDeckMapSqlIdentifier(options.longitudeColumn);
  const quotedLatitude = quoteDeckMapSqlIdentifier(options.latitudeColumn);
  const cleanedSourceSqlQuery = options.sourceSqlQuery
    ?.trim()
    .replace(/(?:\s*;+\s*)+$/, '');
  const baseSource = cleanedSourceSqlQuery
    ? `(${cleanedSourceSqlQuery}) AS "__sqlrooms_dashboard_map_source"`
    : quoteDeckMapSqlTableReference(options.tableReference);

  return [
    `SELECT *, ST_AsWKB(ST_Point(${quotedLongitude}, ${quotedLatitude})) AS ${quoteDeckMapSqlIdentifier(options.geometryColumn)}`,
    `FROM ${baseSource}`,
    `WHERE ${quotedLongitude} IS NOT NULL AND ${quotedLatitude} IS NOT NULL`,
  ].join(' ');
}

/**
 * Builds the standard lon/lat → WKB point transform SQL used by Deck map
 * datasets that follow the selected table via {@link DECK_TABLE_DATASET_SOURCE_RELATION}.
 */
export function createDeckMapPointTransformSql(options: {
  longitudeColumn: string;
  latitudeColumn: string;
  geometryColumn: string;
}) {
  const quotedLongitude = quoteDeckMapSqlIdentifier(options.longitudeColumn);
  const quotedLatitude = quoteDeckMapSqlIdentifier(options.latitudeColumn);

  return [
    `SELECT *, ST_AsWKB(ST_Point(${quotedLongitude}, ${quotedLatitude})) AS ${quoteDeckMapSqlIdentifier(options.geometryColumn)}`,
    `FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
    `WHERE ${quotedLongitude} IS NOT NULL AND ${quotedLatitude} IS NOT NULL`,
  ].join(' ');
}

const DECK_MAP_POINT_LAYER_TYPES = new Set([
  'GeoArrowScatterplotLayer',
  'GeoArrowHeatmapLayer',
  'GeoArrowColumnLayer',
  'GeoJsonLayer',
]);

/** Structured provenance for a table-backed longitude/latitude point dataset. */
export type DeckMapPointBinding = {
  dataset: string;
  longitudeColumn: string;
  latitudeColumn: string;
  geometryColumn?: string;
};

function isDeckMapConfigRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseDeckMapSpecRecord(
  spec: unknown,
): Record<string, unknown> | undefined {
  let parsed: unknown = spec;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return undefined;
    }
  }
  return isDeckMapConfigRecord(parsed) ? parsed : undefined;
}

function deckMapLayerTargetsDataset(options: {
  layer: Record<string, unknown>;
  datasetId: string;
  datasetIds: string[];
}) {
  const binding = isDeckMapConfigRecord(options.layer._sqlroomsBinding)
    ? options.layer._sqlroomsBinding
    : undefined;
  const boundDataset = binding?.dataset;

  if (typeof boundDataset === 'string') {
    return boundDataset === options.datasetId;
  }

  return options.datasetIds.length === 1 && options.layer.data === undefined;
}

/**
 * True when retained layers still need columns that
 * {@link createDeckMapConfigForTable} cannot reconstruct. Binding keys are
 * gated by layer type because type switches keep leftover fields. H3 also
 * accepts `getHexagon: "@@=column"`.
 */
function deckMapDatasetRequiresPreservedTransform(
  config: DeckMapDashboardPanelConfig,
  datasetId: string,
) {
  const spec = parseDeckMapSpecRecord(config.spec);
  if (!spec || !Array.isArray(spec.layers)) {
    return false;
  }
  const datasetIds = Object.keys(config.datasets ?? {});
  return spec.layers.some((layer) => {
    if (!isDeckMapConfigRecord(layer)) return false;
    if (
      !deckMapLayerTargetsDataset({
        layer,
        datasetId,
        datasetIds,
      })
    ) {
      return false;
    }
    return deckMapLayerRequiresPreservedTransform(layer);
  });
}

function deckMapLayerRequiresPreservedTransform(
  layer: Record<string, unknown>,
) {
  const layerType = layer['@@type'];
  const binding = isDeckMapConfigRecord(layer._sqlroomsBinding)
    ? layer._sqlroomsBinding
    : undefined;

  if (layerType === 'GeoArrowArcLayer') {
    return (
      typeof binding?.sourceGeometryColumn === 'string' ||
      typeof binding?.targetGeometryColumn === 'string'
    );
  }
  if (layerType === 'GeoArrowH3HexagonLayer') {
    if (typeof binding?.hexagonColumn === 'string') return true;
    return isDeckMapH3HexagonAccessor(layer.getHexagon);
  }
  if (layerType === 'GeoArrowTripsLayer') {
    return typeof binding?.timestampColumn === 'string';
  }
  return false;
}

function isDeckMapH3HexagonAccessor(value: unknown) {
  return typeof value === 'string' && /^@@=[A-Za-z_][\w]*$/.test(value.trim());
}

/** Retargets layer bindings and generated layer ids at a renamed dataset. */
function renameDeckMapLayerDataset(
  layers: unknown[],
  from: string,
  to: string,
) {
  return layers.map((layer) => {
    if (!isDeckMapConfigRecord(layer)) return layer;
    const binding = isDeckMapConfigRecord(layer._sqlroomsBinding)
      ? layer._sqlroomsBinding
      : undefined;
    const next = {...layer};
    let changed = false;
    if (binding?.dataset === from) {
      next._sqlroomsBinding = {...binding, dataset: to};
      changed = true;
    }
    // Generated layer ids are the dataset id, and the settings layer picker
    // labels layers by id — keep it in step so it stops naming the old table.
    if (layer.id === from) {
      next.id = to;
      changed = true;
    }
    return changed ? next : layer;
  });
}

/** Renames a dataset in a spec record, re-serializing a stored JSON spec. */
function renameDeckMapSpecDataset(
  spec: DeckMapConfig['spec'],
  from: string,
  to: string,
): DeckMapConfig['spec'] | undefined {
  const parsed = parseDeckMapSpecRecord(spec);
  if (!parsed) return undefined;
  const next = Array.isArray(parsed.layers)
    ? {...parsed, layers: renameDeckMapLayerDataset(parsed.layers, from, to)}
    : parsed;
  return (
    typeof spec === 'string' ? JSON.stringify(next) : next
  ) as DeckMapConfig['spec'];
}

/**
 * Rewrites every reference to a dataset id: the `datasets` key, layer bindings
 * and generated layer ids, `fitToData`, and `interaction`.
 *
 * Returns the config unchanged when the rename cannot be applied in full —
 * renaming the dataset without its bindings would detach the layers from
 * their data.
 */
function renameDeckMapDataset(
  config: DeckMapConfig,
  from: string,
  to: string,
): DeckMapConfig {
  if (from === to || !config.datasets?.[from] || config.datasets[to]) {
    return config;
  }
  const spec = renameDeckMapSpecDataset(config.spec, from, to);
  if (spec === undefined) return config;

  return {
    ...config,
    spec,
    datasets: Object.fromEntries(
      Object.entries(config.datasets).map(([id, dataset]) => [
        id === from ? to : id,
        dataset,
      ]),
    ),
    ...(config.fitToData?.dataset === from
      ? {fitToData: {...config.fitToData, dataset: to}}
      : {}),
    ...(config.interaction?.dataset === from
      ? {interaction: {...config.interaction, dataset: to}}
      : {}),
  };
}

/** True when a dataset's source is the given table, so its id can name it. */
function deckMapDatasetReadsTable(
  config: DeckMapConfig,
  datasetId: string,
  table: DataTable,
): boolean {
  const source = config.datasets?.[datasetId]?.source;
  return (
    isDeckMapTableDatasetSource(source) &&
    source.tableName === quoteDeckMapSqlTableReference(table.table)
  );
}

/**
 * Resolves the dataset rename implied by a table pick.
 *
 * Dataset ids are seeded from the table name at creation and otherwise kept
 * stable so retained layer bindings stay valid, which leaves a map that
 * switched tables labelled — in the datasets key, the layer id and binding, and
 * `fitToData` — after a table it no longer reads. Picking a table in settings is
 * an explicit statement about what the map reads, so a single-dataset map
 * re-ids to follow it. A deliberately authored id is not preserved; only AI and
 * code can set one, the picker gives no way to keep it, and matching the visible
 * source beats a name that silently drifts.
 *
 * Multi-dataset maps are left alone: the ids there distinguish datasets from
 * each other, so a table name is not a meaningful identity for one of them.
 */
function resolveDeckMapDatasetRename(
  config: DeckMapConfig,
  table: DataTable,
): {from: string; to: string} | undefined {
  const datasetIds = Object.keys(config.datasets ?? {});
  if (datasetIds.length !== 1) return undefined;
  const from = datasetIds[0]!;
  // The structured segment is the literal catalog name; parsing the flat
  // `tableName` would split a table literally named `events.2026` on its dot.
  const to = table.table.table || table.tableName;
  return to && to !== from ? {from, to} : undefined;
}

/** Strips generated-geometry fit columns so a cleared transform cannot break fitting. */
function clearDeckMapGeneratedFit(
  fitToData: DeckMapFitToDataConfig | undefined,
  datasetId: string,
): DeckMapFitToDataConfig | undefined {
  if (!fitToData || fitToData.dataset !== datasetId) return fitToData;
  const next = {...fitToData};
  delete next.longitudeColumn;
  delete next.latitudeColumn;
  delete next.geometryColumn;
  delete next.geometryColumns;
  delete next.h3Column;
  return next;
}

/** Geometry accessors that can name a column directly as `@@=column`. */
const DECK_MAP_GEOMETRY_ACCESSOR_PROPS = [
  'getPosition',
  'getPath',
  'getPolygon',
] as const;

/**
 * Drops every reference to a dataset's dropped geometry column from a layer.
 *
 * Both routes to the column are cleared: `_sqlroomsBinding.geometryColumn` and
 * a simple `@@=column` geometry accessor, which the runtime falls back to when
 * the binding is absent. Leaving either behind makes the layer request a column
 * the retargeted table does not have.
 */
function clearDeckMapLayerGeometryColumn(
  layer: Record<string, unknown>,
  geometryColumn: string,
): Record<string, unknown> | undefined {
  const binding = isRecord(layer._sqlroomsBinding)
    ? layer._sqlroomsBinding
    : undefined;
  const next = {...layer};
  let changed = false;

  const boundGeometryKeys = (
    ['geometryColumn', 'sourceGeometryColumn', 'targetGeometryColumn'] as const
  ).filter((key) => binding?.[key] === geometryColumn);
  if (binding && boundGeometryKeys.length > 0) {
    const nextBinding = {...binding};
    for (const key of boundGeometryKeys) delete nextBinding[key];
    next._sqlroomsBinding = nextBinding;
    changed = true;
  }
  for (const prop of DECK_MAP_GEOMETRY_ACCESSOR_PROPS) {
    const accessor = layer[prop];
    if (
      typeof accessor === 'string' &&
      accessor.trim() === `@@=${geometryColumn}`
    ) {
      delete next[prop];
      changed = true;
    }
  }

  return changed ? next : undefined;
}

/**
 * Drops a dataset's generated geometry column from its layers.
 *
 * Targets layers with {@link deckMapLayerTargetsDataset} rather than an exact
 * `binding.dataset` match, because that key is optional and the runtime
 * resolves a layer without it to the sole dataset.
 *
 * Handles a spec stored as serialized JSON: leaving a string spec untouched
 * would keep layers requesting a geometry column that no longer exists on the
 * dataset.
 */
function clearDeckMapGeometryColumnBindings(
  config: DeckMapConfig,
  datasetId: string,
  geometryColumn: string | undefined,
): DeckMapConfig {
  if (!geometryColumn) return config;
  const parsed = parseDeckMapSpecRecord(config.spec);
  const layers = parsed?.layers;
  if (!parsed || !Array.isArray(layers)) return config;
  const datasetIds = Object.keys(config.datasets ?? {});

  let changed = false;
  const nextLayers = layers.map((layer) => {
    if (
      !isRecord(layer) ||
      !deckMapLayerTargetsDataset({layer, datasetId, datasetIds})
    ) {
      return layer;
    }
    const nextLayer = clearDeckMapLayerGeometryColumn(layer, geometryColumn);
    if (!nextLayer) return layer;
    changed = true;
    return nextLayer;
  });

  if (!changed) return config;
  const nextSpec = {...parsed, layers: nextLayers};
  return {
    ...config,
    spec: (typeof config.spec === 'string'
      ? JSON.stringify(nextSpec)
      : nextSpec) as DeckMapConfig['spec'],
  };
}

/** Reads an identifier back out of its quoted SQL form. */
function unquoteDeckMapSqlIdentifier(quoted: string) {
  return quoted.slice(1, -1).replace(/""/g, '"');
}

const QUOTED_SQL_IDENTIFIER = String.raw`"(?:[^"]|"")*"`;
const GENERATED_POINT_TRANSFORM_HEAD = new RegExp(
  String.raw`^SELECT \*, ST_AsWKB\(ST_Point\((${QUOTED_SQL_IDENTIFIER}), (${QUOTED_SQL_IDENTIFIER})\)\) AS (${QUOTED_SQL_IDENTIFIER}) `,
);

/**
 * Recognizes the exact SQL {@link createDeckMapPointTransformSql} emits and
 * returns the geometry column it generates, or `undefined` for anything else.
 *
 * The three identifiers are read back out of the candidate and the canonical
 * SQL is regenerated from them, so an authored transform is never mistaken for
 * a generated one — not even hand-written `ST_AsWKB(ST_Point(...))` over
 * columns this module cannot auto-detect, such as `easting`/`northing`.
 *
 * The candidate is normalized the way the dataset compiler normalizes it, so a
 * stored transform that differs only in trailing whitespace or semicolons —
 * which executes identically — is still recognized.
 */
function parseGeneratedDeckMapPointTransform(
  transformSql: string | undefined,
): {geometryColumn: string} | undefined {
  if (!transformSql) return undefined;
  const normalized = normalizeDeckTableTransformSql(transformSql);
  const match = normalized.match(GENERATED_POINT_TRANSFORM_HEAD);
  if (!match) return undefined;
  const [, longitude, latitude, geometry] = match;
  if (!longitude || !latitude || !geometry) return undefined;
  const geometryColumn = unquoteDeckMapSqlIdentifier(geometry);
  return normalized ===
    createDeckMapPointTransformSql({
      longitudeColumn: unquoteDeckMapSqlIdentifier(longitude),
      latitudeColumn: unquoteDeckMapSqlIdentifier(latitude),
      geometryColumn,
    })
    ? {geometryColumn}
    : undefined;
}

/**
 * Points a map's single table-backed dataset at another table.
 *
 * With `dropUnusableTransform`, the generated point transform is removed along
 * with every reference to the column it produced. Authored transforms are
 * always kept — the caller cannot tell whether they would bind, and discarding
 * one would destroy work that only the author can reproduce.
 */
function retargetDeckMapDatasetTableName(
  config: DeckMapConfig,
  table: DataTable,
  options?: {dropUnusableTransform?: boolean},
): DeckMapConfig {
  const datasetIds = Object.keys(config.datasets ?? {});
  if (datasetIds.length !== 1) return config;
  const datasetId = datasetIds[0]!;
  const dataset = config.datasets[datasetId];
  if (!dataset || !isDeckMapTableDatasetSource(dataset.source)) {
    return config;
  }

  const tableName = quoteDeckMapSqlTableReference(table.table);
  // No `deckMapDatasetRequiresPreservedTransform` gate here: that answers
  // whether a regenerated dataset could reconstruct a layer's columns, which is
  // a different question. The canonical point transform produces exactly one
  // column — its geometry alias — and its lon/lat inputs are absent from the
  // picked table, so it can never bind and every reference to it is cleared
  // below. Gating on the layer type instead preserved it for, say, an H3 layer
  // whose hexagon column comes from the source table, leaving the map broken.
  const generatedTransform =
    options?.dropUnusableTransform === true
      ? parseGeneratedDeckMapPointTransform(dataset.source.transformSql)
      : undefined;
  const dropTransform = generatedTransform !== undefined;

  if (dataset.source.tableName === tableName && !dropTransform) return config;

  const source = {...dataset.source, tableName};
  const nextDataset = {...dataset, source};
  if (dropTransform) {
    delete source.transformSql;
    delete nextDataset.geometryColumn;
    delete nextDataset.geometryEncodingHint;
  }

  const retargeted: DeckMapConfig = {
    ...config,
    datasets: {
      ...config.datasets,
      [datasetId]: nextDataset,
    },
    ...(dropTransform
      ? {
          fitToData: clearDeckMapGeneratedFit(config.fitToData, datasetId),
          // The brush reads the same absent coordinate columns as the transform.
          ...(config.interaction?.dataset === datasetId
            ? {interaction: undefined}
            : {}),
        }
      : {}),
  };

  // `geometryColumn` is optional on the dataset, so fall back to the alias the
  // transform itself generates — otherwise the layer keeps requesting it.
  return generatedTransform
    ? clearDeckMapGeometryColumnBindings(
        retargeted,
        datasetId,
        dataset.geometryColumn ?? generatedTransform.geometryColumn,
      )
    : retargeted;
}

function normalizeDeckMapPointLayers<T extends unknown[]>(options: {
  layers: T;
  datasetId: string;
  datasetIds: string[];
  geometryColumn: string;
}): T {
  let changed = false;
  const layers = options.layers.map((layer) => {
    if (!isDeckMapConfigRecord(layer)) {
      return layer;
    }

    const layerType = layer['@@type'];
    if (
      typeof layerType !== 'string' ||
      !DECK_MAP_POINT_LAYER_TYPES.has(layerType) ||
      !deckMapLayerTargetsDataset({
        layer,
        datasetId: options.datasetId,
        datasetIds: options.datasetIds,
      })
    ) {
      return layer;
    }

    changed = true;
    const binding = isDeckMapConfigRecord(layer._sqlroomsBinding)
      ? layer._sqlroomsBinding
      : {};
    const geometryBinding = {...binding};
    delete geometryBinding.longitudeColumn;
    delete geometryBinding.latitudeColumn;
    const pointLayer = {...layer};
    delete pointLayer.getPosition;

    return {
      ...pointLayer,
      _sqlroomsBinding: {
        ...geometryBinding,
        dataset:
          typeof binding.dataset === 'string'
            ? binding.dataset
            : options.datasetId,
        geometryColumn: options.geometryColumn,
      },
    };
  });

  return (changed ? layers : options.layers) as T;
}

/**
 * Applies a structured longitude/latitude point binding to a native Deck map
 * config. The generated geometry SQL intentionally comes from the same
 * canonical helper used by first-party map builders.
 */
export function applyDeckMapPointBinding<
  T extends DeckMapDashboardPanelConfig,
>(options: {
  config: T;
  pointBinding: DeckMapPointBinding;
  sourceColumns: readonly DeckMapConfigColumn[];
}): T {
  const {config, pointBinding} = options;
  const datasetId = pointBinding.dataset.trim();
  const longitudeColumn = pointBinding.longitudeColumn.trim();
  const latitudeColumn = pointBinding.latitudeColumn.trim();
  if (!datasetId || !longitudeColumn || !latitudeColumn) {
    throw new Error(
      'Point binding requires dataset, longitudeColumn, and latitudeColumn.',
    );
  }

  const dataset = config.datasets[datasetId];
  if (!dataset) {
    throw new Error(`Point binding references unknown dataset "${datasetId}".`);
  }
  if (!isDeckMapTableDatasetSource(dataset.source)) {
    throw new Error(
      `Point binding dataset "${datasetId}" must use source.tableName.`,
    );
  }

  const geometryColumn =
    pointBinding.geometryColumn?.trim() || DEFAULT_GEOMETRY_COLUMN;
  const sourceColumnNames = new Set(
    options.sourceColumns.map((column) => column.name.toLowerCase()),
  );
  for (const [bindingName, columnName] of [
    ['longitudeColumn', longitudeColumn],
    ['latitudeColumn', latitudeColumn],
  ] as const) {
    if (!sourceColumnNames.has(columnName.toLowerCase())) {
      throw new Error(
        `Point binding ${bindingName} "${columnName}" was not found in source columns.`,
      );
    }
  }
  if (sourceColumnNames.has(geometryColumn.toLowerCase())) {
    throw new Error(
      `Point binding geometryColumn "${geometryColumn}" conflicts with an existing source column.`,
    );
  }
  const datasetIds = Object.keys(config.datasets);
  let parsedSpec: unknown = config.spec;
  if (typeof parsedSpec === 'string') {
    try {
      parsedSpec = JSON.parse(parsedSpec);
    } catch {
      // Durable resource validation reports the invalid serialized spec.
    }
  }
  const spec = isDeckMapConfigRecord(parsedSpec)
    ? {
        ...parsedSpec,
        ...(Array.isArray(parsedSpec.layers)
          ? {
              layers: normalizeDeckMapPointLayers({
                layers: parsedSpec.layers,
                datasetId,
                datasetIds,
                geometryColumn,
              }),
            }
          : {}),
      }
    : parsedSpec;
  let fitToData = config.fitToData;
  if (isDeckMapConfigRecord(fitToData) && fitToData.dataset === datasetId) {
    const geometryFit = {...fitToData};
    delete geometryFit.longitudeColumn;
    delete geometryFit.latitudeColumn;
    delete geometryFit.geometryColumns;
    delete geometryFit.h3Column;
    fitToData = {...geometryFit, geometryColumn};
  } else if (!fitToData) {
    fitToData = {
      dataset: datasetId,
      geometryColumn,
      padding: 40,
      maxZoom: 12,
    };
  }
  const interaction =
    config.interaction?.type === 'point-radius-brush' &&
    config.interaction.dataset === datasetId
      ? {...config.interaction, longitudeColumn, latitudeColumn}
      : config.interaction;

  return {
    ...config,
    spec,
    ...(interaction !== config.interaction ? {interaction} : {}),
    datasets: {
      ...config.datasets,
      [datasetId]: {
        ...dataset,
        source: {
          tableName: dataset.source.tableName,
          transformSql: createDeckMapPointTransformSql({
            longitudeColumn,
            latitudeColumn,
            geometryColumn,
          }),
        },
        geometryColumn,
        geometryEncodingHint: 'wkb',
      },
    },
    fitToData,
  } as T;
}

/**
 * Post-normalizes an existing Deck map config so table-backed lon/lat datasets
 * without `transformSql`, `sqlQuery`, or a native geometry column get a WKB
 * point transform, geometry bindings, and `fitToData.geometryColumn` alignment.
 *
 * Prefer this for AI/tool configs that arrive without a transform. Fresh configs
 * from {@link createDeckMapDashboardConfigForTable} already include the transform;
 * this helper patches in place without rebuilding layers.
 */
export function normalizeDeckMapPointConfig<
  T extends DeckMapDashboardPanelConfig,
>(options: {
  config: T;
  resolveTable: (tableName: string) => DataTable | undefined;
}): T {
  const {config, resolveTable} = options;
  const datasets = isDeckMapConfigRecord(config.datasets)
    ? config.datasets
    : undefined;
  if (!datasets) {
    return config;
  }

  const datasetIds = Object.keys(datasets);
  let nextDatasets = datasets;
  let nextSpec = config.spec;
  let nextFitToData = config.fitToData;
  let changed = false;

  for (const [datasetId, datasetValue] of Object.entries(datasets)) {
    if (!isDeckMapConfigRecord(datasetValue)) {
      continue;
    }
    const dataset = datasetValue;

    const source = isDeckMapConfigRecord(dataset.source as unknown)
      ? (dataset.source as Record<string, unknown>)
      : undefined;
    const tableName =
      typeof source?.tableName === 'string' ? source.tableName : undefined;
    const configuredGeometryColumn =
      typeof dataset.geometryColumn === 'string'
        ? dataset.geometryColumn.trim()
        : undefined;
    if (
      !tableName ||
      source?.sqlQuery ||
      source?.transformSql ||
      (configuredGeometryColumn &&
        configuredGeometryColumn !== DEFAULT_GEOMETRY_COLUMN)
    ) {
      continue;
    }

    const table = resolveTable(tableName);
    if (
      configuredGeometryColumn === DEFAULT_GEOMETRY_COLUMN &&
      table?.columns.some((column) => column.name === configuredGeometryColumn)
    ) {
      continue;
    }
    if (findGeometryColumn(table)) {
      continue;
    }
    const coordinateColumns = findLongitudeLatitudeColumns(table);
    if (!coordinateColumns) {
      continue;
    }

    const geometryColumn = DEFAULT_GEOMETRY_COLUMN;

    nextDatasets = {
      ...nextDatasets,
      [datasetId]: {
        ...dataset,
        source: {
          ...source,
          tableName,
          transformSql: createDeckMapPointTransformSql({
            ...coordinateColumns,
            geometryColumn,
          }),
        },
        geometryColumn,
        geometryEncodingHint: 'wkb',
      },
    };

    if (
      isDeckMapConfigRecord(nextSpec) &&
      Array.isArray(nextSpec.layers) &&
      nextSpec.layers.length > 0
    ) {
      nextSpec = {
        ...nextSpec,
        layers: normalizeDeckMapPointLayers({
          layers: nextSpec.layers,
          datasetId,
          datasetIds,
          geometryColumn,
        }),
      };
    }

    nextFitToData =
      isDeckMapConfigRecord(nextFitToData) &&
      nextFitToData.dataset === datasetId
        ? {
            ...nextFitToData,
            geometryColumn,
          }
        : (nextFitToData ?? {
            dataset: datasetId,
            geometryColumn,
            padding: 40,
            maxZoom: 12,
          });

    changed = true;
  }

  if (!changed) {
    return config;
  }

  return {
    ...config,
    spec: nextSpec,
    datasets: nextDatasets,
    fitToData: nextFitToData,
  } as T;
}

export function normalizeDeckMapFillColor(
  fillColor?: number[],
): DeckMapFillColor {
  if (fillColor?.length === 3) {
    return [fillColor[0]!, fillColor[1]!, fillColor[2]!];
  }
  if (fillColor?.length === 4) {
    return [fillColor[0]!, fillColor[1]!, fillColor[2]!, fillColor[3]!];
  }
  return [...DEFAULT_FILL_COLOR];
}

export function createDeckMapConfigForTable(options: {
  tableName: string;
  columns: DeckMapConfigColumn[];
  tableReference?: DeckMapTableReference;
  sourceSqlQuery?: string;
  longitudeColumn?: string;
  latitudeColumn?: string;
  geometryColumn?: string;
  geometryEncodingHint?: GeometryEncodingHint;
  pointRadius?: number;
  fillColor?: DeckMapFillColor;
  mapStyle?: string;
}): DeckMapConfig {
  const datasetId = options.tableName;
  const explicitGeometryColumn = options.geometryColumn?.trim() || undefined;
  const detectedCoordinates =
    options.longitudeColumn && options.latitudeColumn
      ? {
          longitudeColumn: options.longitudeColumn,
          latitudeColumn: options.latitudeColumn,
        }
      : findDeckMapLongitudeLatitudeColumns(options.columns);
  const detectedGeometryColumn = explicitGeometryColumn
    ? {
        geometryColumn: explicitGeometryColumn,
        geometryEncodingHint: options.geometryEncodingHint,
      }
    : detectedCoordinates
      ? null
      : findDeckMapGeometryColumn(options.columns);
  const coordinates = detectedGeometryColumn
    ? undefined
    : resolveDeckMapCoordinateColumns({
        columns: options.columns,
        longitudeColumn: options.longitudeColumn,
        latitudeColumn: options.latitudeColumn,
      });
  const geometryColumn =
    detectedGeometryColumn?.geometryColumn ?? DEFAULT_GEOMETRY_COLUMN;
  const geometryEncodingHint =
    options.geometryEncodingHint ??
    detectedGeometryColumn?.geometryEncodingHint;
  const source = coordinates
    ? options.sourceSqlQuery
      ? {
          sqlQuery: createDeckMapPointSourceSql({
            sourceSqlQuery: options.sourceSqlQuery,
            tableReference: options.tableReference ?? options.tableName,
            longitudeColumn: coordinates.longitudeColumn,
            latitudeColumn: coordinates.latitudeColumn,
            geometryColumn,
          }),
        }
      : {
          tableName: options.tableReference
            ? quoteDeckMapSqlTableReference(options.tableReference)
            : options.tableName,
          transformSql: createDeckMapPointTransformSql({
            longitudeColumn: coordinates.longitudeColumn,
            latitudeColumn: coordinates.latitudeColumn,
            geometryColumn,
          }),
        }
    : options.sourceSqlQuery
      ? {sqlQuery: options.sourceSqlQuery}
      : {tableName: options.tableName};

  if (detectedGeometryColumn) {
    ensureDeckMapColumnExists(
      options.columns,
      detectedGeometryColumn.geometryColumn,
      'geometry',
    );
  }

  return {
    spec: {
      initialViewState: {longitude: 0, latitude: 20, zoom: 1.5},
      layers: [
        {
          '@@type': coordinates
            ? 'GeoArrowScatterplotLayer'
            : 'GeoArrowPolygonLayer',
          id: datasetId,
          _sqlroomsBinding: {
            dataset: datasetId,
            ...(detectedGeometryColumn
              ? {geometryColumn: detectedGeometryColumn.geometryColumn}
              : {}),
          },
          filled: true,
          stroked: false,
          pickable: true,
          radiusUnits: 'pixels',
          getRadius: options.pointRadius ?? 4,
          getFillColor: options.fillColor ?? [...DEFAULT_FILL_COLOR],
        },
      ],
    },
    datasets: {
      [datasetId]: {
        source,
        geometryColumn,
        geometryEncodingHint: coordinates ? 'wkb' : geometryEncodingHint,
      },
    },
    ...(coordinates
      ? {
          fitToData: {
            dataset: datasetId,
            longitudeColumn: coordinates.longitudeColumn,
            latitudeColumn: coordinates.latitudeColumn,
            padding: 40,
            maxZoom: 12,
          },
        }
      : detectedGeometryColumn
        ? {
            fitToData: {
              dataset: datasetId,
              geometryColumn: detectedGeometryColumn.geometryColumn,
              padding: 40,
              maxZoom: 12,
            },
          }
        : {}),
    mapStyle: options.mapStyle ?? getDefaultDeckMapStyle(),
  };
}

export const createDeckMapDashboardConfigForTable = createDeckMapConfigForTable;

export function createDeckMapDashboardPanelConfigForTable(options: {
  title?: string;
  tableName: string;
  columns: DeckMapConfigColumn[];
  tableReference?: DeckMapTableReference;
  sourceSqlQuery?: string;
  longitudeColumn?: string;
  latitudeColumn?: string;
  geometryColumn?: string;
  geometryEncodingHint?: GeometryEncodingHint;
  pointRadius?: number;
  fillColor?: DeckMapFillColor;
  mapStyle?: string;
}) {
  return createDeckMapDashboardPanelConfig({
    title: options.title,
    ...createDeckMapConfigForTable(options),
  });
}

/**
 * Regenerates a map's dataset source and fit configuration for a table while
 * preserving an existing single dataset ID so retained layer bindings remain
 * valid. Empty maps adopt the generated dataset and layer spec. Returns the
 * existing config unchanged when the table has no supported geospatial columns
 * or when multiple datasets make the target ambiguous.
 *
 * Authored arc, H3, and trips transforms are kept; only the table name
 * is retargeted. Point and polygon maps still regenerate their dataset source.
 */
export function regenerateMapConfigForTable(
  panel: {config: Record<string, unknown>},
  table: DataTable,
  longitudeColumn?: string,
  latitudeColumn?: string,
) {
  const coordinateColumns = resolveDeckMapCoordinateColumnNames({
    columns: table.columns,
    longitudeColumn,
    latitudeColumn,
  });
  if (!coordinateColumns && !findGeometryColumn(table)) {
    return panel.config;
  }

  const existingConfig = panel.config as DeckMapDashboardPanelConfig;
  const existingDatasetIds = Object.keys(existingConfig.datasets ?? {});
  if (existingDatasetIds.length > 1) return panel.config;

  const nextConfig = createDeckMapConfigForTable({
    tableName: table.tableName,
    columns: table.columns,
    tableReference: table.table,
    longitudeColumn: coordinateColumns?.longitudeColumn,
    latitudeColumn: coordinateColumns?.latitudeColumn,
  });
  const nextDataset = Object.values(nextConfig.datasets)[0];

  if (existingDatasetIds.length === 0) {
    return {
      ...nextConfig,
      mapStyle: existingConfig.mapStyle,
      mapProps: existingConfig.mapProps,
    };
  }

  if (existingDatasetIds.length === 1 && nextDataset) {
    const datasetId = existingDatasetIds[0]!;
    const existingDataset = existingConfig.datasets?.[datasetId];
    if (
      isDeckMapTableDatasetSource(existingDataset?.source) &&
      deckMapDatasetRequiresPreservedTransform(existingConfig, datasetId)
    ) {
      return retargetDeckMapDatasetTableName(existingConfig, table);
    }
    return updateDeckMapGeometryColumnBindings(
      {
        ...existingConfig,
        datasets: {[datasetId]: nextDataset},
        fitToData: nextConfig.fitToData
          ? {...nextConfig.fitToData, dataset: datasetId}
          : existingConfig.fitToData,
      },
      datasetId,
      nextDataset.geometryColumn,
    );
  }

  // Preserve existing layer spec (layer types, styling, bindings) — only
  // update the dataset source and fitToData so the data re-fetches with the
  // new coordinate columns.
  return {
    ...existingConfig,
    datasets: nextConfig.datasets,
    fitToData: nextConfig.fitToData ?? existingConfig.fitToData,
  };
}

/**
 * Applies a document map table pick: regenerate geospatial config when
 * possible, otherwise retarget the single table-backed dataset.
 *
 * Reaching the retarget path means the table exposes no coordinate or geometry
 * columns, so a generated point transform can never bind against it and would
 * leave the dataset unreadable — even its schema fails to describe, which hides
 * the settings pickers needed to repair the map. Such a transform is dropped
 * unless a retained arc/H3/trips layer still depends on the columns it produces;
 * those keep it so switching away and back restores a working map. Only the
 * exact generated SQL is dropped — see
 * {@link isGeneratedDeckMapPointTransform}.
 *
 * The dataset id follows the pick so the spec stops naming the old table, but
 * only once the dataset actually reads the picked table; see
 * {@link resolveDeckMapDatasetRename} and {@link deckMapDatasetReadsTable}.
 */
export function applyDeckMapTableSelection(
  config: DeckMapConfig,
  table: DataTable,
  longitudeColumn?: string,
  latitudeColumn?: string,
): DeckMapConfig {
  const rename = resolveDeckMapDatasetRename(config, table);
  const regenerated = regenerateMapConfigForTable(
    {config},
    table,
    longitudeColumn,
    latitudeColumn,
  );
  const retargeted =
    regenerated !== config
      ? (regenerated as DeckMapConfig)
      : retargetDeckMapDatasetTableName(config, table, {
          dropUnusableTransform: true,
        });

  return rename && deckMapDatasetReadsTable(retargeted, rename.from, table)
    ? renameDeckMapDataset(retargeted, rename.from, rename.to)
    : retargeted;
}
