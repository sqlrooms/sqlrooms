import {JSONConfiguration} from '@deck.gl/json';
import * as arrow from 'apache-arrow';
import type {ColorScaleConfig} from '@sqlrooms/color-scales';
import {wkbGeometryDecoder} from '../prepare/wkbDecoder';
import type {ResolvedGeometryColumn} from '../prepare/types';
import type {LayerBindingProps, PreparedDeckDatasetState} from '../types';
import {createColorScaleMarker, getColorScale} from './colorScaleFunction';
import {compileColorScale} from './compileColorScale';
import {
  DEFAULT_DECK_JSON_CLASSES,
  DEFAULT_DECK_JSON_CONSTANTS,
  DEFAULT_DECK_JSON_ENUMERATIONS,
} from './defaultClasses';
import {getLayerCompatibility} from './layerCompatibility';
import {
  isManagedLayer,
  resolveConfiguredColumn,
  resolveDatasetId,
  resolveGeometryColumn,
  stripLayerExtensionProps,
} from './layerConfig';
import {rewriteGeoArrowAccessors} from './rewriteGeoArrowAccessors';

type CreateDeckJsonConfigurationOptions = {
  datasetStates: Record<string, PreparedDeckDatasetState>;
  datasetIds: string[];
};

function getLayerName(Class: unknown) {
  const maybeClass = Class as {layerName?: string; name?: string};
  return maybeClass.layerName ?? maybeClass.name ?? 'UnknownLayer';
}

function applyColorScale(options: {
  props: Record<string, unknown>;
  table: import('apache-arrow').Table;
}) {
  const {props, table} = options;
  const resolved = getColorScale(props);
  if (!resolved) {
    return props;
  }

  const {propName, colorScale} = resolved;

  const updateTriggers =
    props.updateTriggers &&
    typeof props.updateTriggers === 'object' &&
    !Array.isArray(props.updateTriggers)
      ? (props.updateTriggers as Record<string, unknown>)
      : {};

  return {
    ...props,
    [propName]: compileColorScale({
      table,
      colorScale,
    }),
    updateTriggers: {
      ...updateTriggers,
      [propName]: JSON.stringify(colorScale),
    },
  };
}

const ARC_COORD_PATTERNS: Record<
  string,
  {latKeys: string[]; lonKeys: string[]}
> = {
  sourceGeometryColumn: {
    latKeys: ['source_lat', 'source_latitude', 'src_lat', 'origin_lat'],
    lonKeys: [
      'source_lon',
      'source_lng',
      'source_longitude',
      'src_lon',
      'origin_lon',
    ],
  },
  targetGeometryColumn: {
    latKeys: [
      'target_lat',
      'target_latitude',
      'dst_lat',
      'dest_lat',
      'destination_lat',
    ],
    lonKeys: [
      'target_lon',
      'target_lng',
      'target_longitude',
      'dst_lon',
      'dest_lon',
      'destination_lon',
    ],
  },
};

function trySynthesizeGeometryFromBinding(
  table: arrow.Table,
  configKey: string,
  layerProps: LayerBindingProps & Record<string, unknown>,
): ResolvedGeometryColumn | null {
  const patterns = ARC_COORD_PATTERNS[configKey];
  if (!patterns) return null;

  const fieldNames = table.schema.fields.map((f) => f.name);
  const fieldNamesLower = fieldNames.map((n) => n.toLowerCase());

  // Check explicit binding columns first
  const binding = layerProps._sqlroomsBinding;
  const prefix = configKey === 'sourceGeometryColumn' ? 'source' : 'target';
  const explicitLat = (binding as Record<string, unknown>)?.[
    `${prefix}LatitudeColumn`
  ] as string | undefined;
  const explicitLon = (binding as Record<string, unknown>)?.[
    `${prefix}LongitudeColumn`
  ] as string | undefined;

  let latField: string | undefined;
  let lonField: string | undefined;

  if (explicitLat && explicitLon) {
    latField =
      fieldNames.find((n) => n === explicitLat) ??
      fieldNames.find((n) => n.toLowerCase() === explicitLat.toLowerCase());
    lonField =
      fieldNames.find((n) => n === explicitLon) ??
      fieldNames.find((n) => n.toLowerCase() === explicitLon.toLowerCase());
  }

  if (!latField || !lonField) {
    // Try pattern matching
    for (const key of patterns.latKeys) {
      const idx = fieldNamesLower.indexOf(key);
      if (idx >= 0) {
        latField = fieldNames[idx];
        break;
      }
    }
    for (const key of patterns.lonKeys) {
      const idx = fieldNamesLower.indexOf(key);
      if (idx >= 0) {
        lonField = fieldNames[idx];
        break;
      }
    }
  }

  if (!latField || !lonField) return null;

  const latVector = table.getChild(latField);
  const lonVector = table.getChild(lonField);
  if (!latVector || !lonVector) return null;

  const numRows = table.numRows;
  const flatCoords = new Float64Array(numRows * 2);
  for (let i = 0; i < numRows; i++) {
    flatCoords[i * 2] = Number(lonVector.get(i)) || 0;
    flatCoords[i * 2 + 1] = Number(latVector.get(i)) || 0;
  }

  const coordField = new arrow.Field('xy', new arrow.Float64(), false);
  const pointType = new arrow.FixedSizeList(2, coordField);
  const floatData = arrow.makeData({
    type: new arrow.Float64(),
    length: numRows * 2,
    data: flatCoords,
  });
  const pointData = arrow.makeData({
    type: pointType,
    length: numRows,
    child: floatData,
  });

  return {
    columnName: configKey,
    vector: new arrow.Vector([pointData]),
    encoding: 'geoarrow.point',
    nativeGeoArrow: true,
  };
}

const GROUP_ID_PATTERNS = [
  'path_id',
  'route_id',
  'trip_id',
  'track_id',
  'line_id',
  'segment_id',
  'id',
  'path',
  'route',
  'trip',
  'track',
];
const ORDER_PATTERNS = [
  'waypoint_order',
  'point_order',
  'order',
  'sequence',
  'seq',
  'waypoint',
  'index',
  'step',
  'position',
  'sort',
];

function findColumnByPatterns(
  fieldNames: string[],
  patterns: string[],
): string | undefined {
  const lower = fieldNames.map((n) => n.toLowerCase());
  for (const pattern of patterns) {
    const idx = lower.indexOf(pattern);
    if (idx >= 0) return fieldNames[idx];
  }
  return undefined;
}

function findLatLonColumns(
  table: arrow.Table,
): {lat: string; lon: string} | null {
  const fields = table.schema.fields.map((f) => f.name);
  const lower = fields.map((n) => n.toLowerCase());
  const latPatterns = ['lat', 'latitude', 'source_lat'];
  const lonPatterns = ['lon', 'lng', 'longitude', 'source_lon'];
  let lat: string | undefined;
  let lon: string | undefined;
  for (const p of latPatterns) {
    const idx = lower.indexOf(p);
    if (idx >= 0) {
      lat = fields[idx];
      break;
    }
  }
  for (const p of lonPatterns) {
    const idx = lower.indexOf(p);
    if (idx >= 0) {
      lon = fields[idx];
      break;
    }
  }
  if (lat && lon) return {lat, lon};
  return null;
}

/**
 * Auto-aggregates per-waypoint rows into LineString vectors for PathLayer.
 * Detects group-by ID and order columns by naming patterns, groups rows,
 * and builds a GeoArrow List<FixedSizeList<2, Float64>> linestring vector.
 */
function tryAggregateWaypointsToLineStrings(
  table: arrow.Table,
): {table: arrow.Table; geometryVector: arrow.Vector} | null {
  const fieldNames = table.schema.fields.map((f) => f.name);
  const groupCol = findColumnByPatterns(fieldNames, GROUP_ID_PATTERNS);
  if (!groupCol) return null;

  const coords = findLatLonColumns(table);
  if (!coords) return null;

  const orderCol = findColumnByPatterns(fieldNames, ORDER_PATTERNS);

  const groupVector = table.getChild(groupCol)!;
  const latVector = table.getChild(coords.lat)!;
  const lonVector = table.getChild(coords.lon)!;
  const orderVector = orderCol ? table.getChild(orderCol) : null;

  // Collect rows per group
  const groups = new Map<string, {indices: number[]}>();
  const groupOrder: string[] = [];
  for (let i = 0; i < table.numRows; i++) {
    const key = String(groupVector.get(i) ?? '');
    let group = groups.get(key);
    if (!group) {
      group = {indices: []};
      groups.set(key, group);
      groupOrder.push(key);
    }
    group.indices.push(i);
  }

  // Sort indices within each group by order column
  if (orderVector) {
    for (const group of groups.values()) {
      group.indices.sort((a, b) => {
        const av = Number(orderVector.get(a)) || 0;
        const bv = Number(orderVector.get(b)) || 0;
        return av - bv;
      });
    }
  }

  const numPaths = groupOrder.length;
  const offsets = new Int32Array(numPaths + 1);
  let totalPoints = 0;

  for (let g = 0; g < numPaths; g++) {
    offsets[g] = totalPoints;
    totalPoints += groups.get(groupOrder[g]!)!.indices.length;
  }
  offsets[numPaths] = totalPoints;

  const flatCoords = new Float64Array(totalPoints * 2);
  let writeIdx = 0;
  for (const key of groupOrder) {
    for (const rowIdx of groups.get(key)!.indices) {
      flatCoords[writeIdx++] = Number(lonVector.get(rowIdx)) || 0;
      flatCoords[writeIdx++] = Number(latVector.get(rowIdx)) || 0;
    }
  }

  // Build GeoArrow LineString vector: List<FixedSizeList<2, Float64>>
  const coordField = new arrow.Field('xy', new arrow.Float64(), false);
  const vertexType = new arrow.FixedSizeList(2, coordField);
  const vertexField = new arrow.Field('', vertexType, true);
  const lineStringType = new arrow.List(vertexField);

  const floatData = arrow.makeData({
    type: new arrow.Float64(),
    length: totalPoints * 2,
    data: flatCoords,
  });
  const vertexData = arrow.makeData({
    type: vertexType,
    length: totalPoints,
    child: floatData,
  });
  const lineData = arrow.makeData({
    type: lineStringType,
    length: numPaths,
    valueOffsets: offsets,
    child: vertexData,
  });
  const geometryVector = new arrow.Vector([lineData]);

  // Build aggregated table with one row per path (first row's non-geom values)
  const columns: Record<string, arrow.Vector> = {};
  const excludeCols = new Set(
    [coords.lat, coords.lon, orderCol].filter(Boolean),
  );

  for (const field of table.schema.fields) {
    if (excludeCols.has(field.name)) continue;
    const srcVector = table.getChild(field.name)!;
    // Take first value from each group
    const values: unknown[] = [];
    for (const key of groupOrder) {
      const firstIdx = groups.get(key)!.indices[0]!;
      values.push(srcVector.get(firstIdx));
    }
    columns[field.name] = arrow.vectorFromArray(values);
  }
  columns['__geom'] = geometryVector;

  const aggregatedTable = new arrow.Table(columns);
  return {table: aggregatedTable, geometryVector};
}

function resolveGeoArrowBindings(options: {
  layerName: string;
  compatibility: NonNullable<ReturnType<typeof getLayerCompatibility>> & {
    representation: 'geoarrow';
  };
  layerProps: LayerBindingProps & Record<string, unknown>;
  prepared: Extract<PreparedDeckDatasetState, {status: 'ready'}>['prepared'];
  props: Record<string, unknown>;
}) {
  const {layerName, compatibility, layerProps, prepared, props} = options;
  let table = prepared.table;
  const boundProps: Record<string, unknown> = {};

  for (const binding of compatibility.bindings) {
    if (props[binding.prop] !== undefined) {
      continue;
    }

    if (binding.kind === 'geometry') {
      const columnName = resolveConfiguredColumn(layerProps, binding.configKey);
      if (binding.required && !columnName) {
        throw new Error(
          `Layer "${layerName}" requires _sqlroomsBinding.${binding.configKey}.`,
        );
      }

      let resolvedGeometry;
      let synthesizedVector: arrow.Vector | null = null;
      try {
        resolvedGeometry = prepared.resolveGeometry(columnName);
      } catch {
        // Geometry column not found — try synthesizing from lat/lon columns
        // for arc layers where source/target have separate coordinate columns
        const synthesized = trySynthesizeGeometryFromBinding(
          prepared.table,
          binding.configKey,
          layerProps,
        );
        if (synthesized) {
          resolvedGeometry = synthesized;
          synthesizedVector = synthesized.vector;
        } else {
          throw new Error(
            `Geometry column "${columnName}" was not found and could not be synthesized from lat/lon columns.`,
          );
        }
      }

      // Detect mismatch: synthesized points can't satisfy a LineString binding.
      // For PathLayer, try auto-aggregating waypoint rows into linestrings.
      if (
        resolvedGeometry.encoding === 'geoarrow.point' &&
        binding.prop === 'getPath'
      ) {
        const aggregated = tryAggregateWaypointsToLineStrings(prepared.table);
        if (aggregated) {
          table = aggregated.table;
          boundProps[binding.prop] = aggregated.geometryVector;
          continue;
        }
        const available = prepared.table.schema.fields
          .map((f) => f.name)
          .join(', ');
        throw new Error(
          `Layer "${layerName}" requires LineString geometry for getPath, ` +
            `but only point coordinates were found and auto-aggregation failed. ` +
            `The dataset sqlQuery must aggregate rows into linestrings using ST_MakeLine. ` +
            `Available columns: ${available}.`,
        );
      }
      if (
        resolvedGeometry.encoding === 'geoarrow.point' &&
        binding.prop === 'getPolygon'
      ) {
        const available = prepared.table.schema.fields
          .map((f) => f.name)
          .join(', ');
        throw new Error(
          `Layer "${layerName}" requires Polygon geometry for ${binding.prop}, ` +
            `but only point coordinates were found. Available columns: ${available}.`,
        );
      }
      if (!resolvedGeometry.nativeGeoArrow) {
        if (
          !compatibility.allowGeoArrowPromotion ||
          !wkbGeometryDecoder.supportsGeoArrowPromotion(
            layerName,
            resolvedGeometry.encoding,
            prepared.table,
            resolvedGeometry.columnName,
          )
        ) {
          throw new Error(
            `Layer "${layerName}" cannot render geometry encoding "${resolvedGeometry.encoding}" for dataset "${prepared.datasetId}".`,
          );
        }
      }

      if (synthesizedVector) {
        boundProps[binding.prop] = synthesizedVector;
      } else {
        const layerData = prepared.getGeoArrowLayerData(columnName);
        if (table !== prepared.table && table !== layerData.table) {
          throw new Error(
            `Layer "${layerName}" cannot combine promoted geometry columns from different prepared tables.`,
          );
        }
        table = layerData.table;
        boundProps[binding.prop] = layerData.geometryColumn;
      }
      continue;
    }

    const columnName = resolveConfiguredColumn(layerProps, binding.configKey);
    if (!columnName) {
      if (binding.required) {
        throw new Error(
          `Layer "${layerName}" requires _sqlroomsBinding.${binding.configKey}.`,
        );
      }
      continue;
    }

    const vector =
      table.getChild(columnName) ?? prepared.table.getChild(columnName);
    if (!vector) {
      throw new Error(
        `Layer "${layerName}" references unknown column "${columnName}" for ${binding.prop}.`,
      );
    }

    boundProps[binding.prop] = vector;
  }

  return {table, boundProps};
}

export function createDeckJsonConfiguration(
  options: CreateDeckJsonConfigurationOptions,
) {
  const {datasetStates, datasetIds} = options;

  return new JSONConfiguration({
    classes: DEFAULT_DECK_JSON_CLASSES,
    enumerations: DEFAULT_DECK_JSON_ENUMERATIONS,
    constants: DEFAULT_DECK_JSON_CONSTANTS,
    functions: {
      colorScale: (props: ColorScaleConfig) => createColorScaleMarker(props),
      scale: (props: Record<string, unknown>) => {
        const field = typeof props.field === 'string' ? props.field : undefined;
        if (!field) return undefined;
        return `@@=${field}`;
      },
    },
    // TODO(geoarrow-upgrade): In 0.3.x we preserve raw `@@=` strings here because
    // `@deck.gl/json` would otherwise eagerly compile them into row-based accessors
    // before `preProcessClassProps` can rewrite them for GeoArrow. If the next
    // GeoArrow version can consume deck.gl/json's converted accessors directly, or
    // exposes a cleaner injection seam, remove this shim.
    convertFunction: ((expression: string) => `@@=${expression}`) as never,
    preProcessClassProps: (Class: unknown, props: Record<string, unknown>) => {
      const layerName = getLayerName(Class);
      const compatibility = getLayerCompatibility(layerName);

      if (!compatibility) {
        return props;
      }

      const layerProps = props as Record<string, unknown>;
      const extensionProps = layerProps as typeof layerProps &
        LayerBindingProps;
      const datasetId = resolveDatasetId(extensionProps, datasetIds);
      const managed =
        isManagedLayer(extensionProps, datasetIds) ||
        (datasetIds.length > 1 && layerProps.data === undefined);

      if (!managed) {
        return props;
      }

      if (!datasetId) {
        throw new Error(
          `Layer "${layerName}" must declare _sqlroomsBinding.dataset when multiple datasets are available.`,
        );
      }

      const datasetState = datasetStates[datasetId];
      if (!datasetState) {
        throw new Error(
          `Layer "${layerName}" references unknown dataset "${datasetId}".`,
        );
      }

      if (datasetState.status !== 'ready') {
        return stripLayerExtensionProps(layerProps);
      }

      const prepared = datasetState.prepared;
      const geometryColumn = resolveGeometryColumn(extensionProps);
      const strippedProps = stripLayerExtensionProps(layerProps);

      if (compatibility.representation === 'geojson') {
        const baseProps = applyColorScale({
          props: strippedProps,
          table: prepared.table,
        });
        return {
          ...baseProps,
          data: prepared.getGeoJsonBinaryData(geometryColumn),
        };
      }

      if (compatibility.representation === 'row') {
        const table = prepared.table;
        // Determine which column is the H3 index (needs BigInt→hex conversion)
        const hexColumnName = extensionProps._sqlroomsBinding?.hexagonColumn;

        const rows = Array.from({length: table.numRows}, (_, i) => {
          const row: Record<string, unknown> = {};
          for (const field of table.schema.fields) {
            let val = table.getChild(field.name)?.get(i);
            // Convert BigInt H3 indices to hex strings for h3-js compatibility
            if (field.name === hexColumnName && typeof val === 'bigint') {
              val = val.toString(16);
            }
            row[field.name] = val;
          }
          return row;
        });

        const baseProps = applyColorScale({
          props: strippedProps,
          table,
        });
        const resolvedProps: Record<string, unknown> = {
          ...baseProps,
          data: rows,
        };
        // Resolve hexagonColumn binding into a getHexagon accessor
        if (hexColumnName && !resolvedProps.getHexagon) {
          resolvedProps.getHexagon = (d: Record<string, unknown>) =>
            d[hexColumnName];
        }
        for (const [key, value] of Object.entries(resolvedProps)) {
          if (
            typeof value === 'string' &&
            value.startsWith('@@=') &&
            key.startsWith('get')
          ) {
            const fieldName = value.slice(3).trim();
            resolvedProps[key] = (d: Record<string, unknown>) => d[fieldName];
          }
        }
        return resolvedProps;
      }

      const {table, boundProps} = resolveGeoArrowBindings({
        layerName,
        compatibility,
        layerProps: extensionProps,
        prepared,
        props: strippedProps,
      });
      const baseProps = applyColorScale({
        props: strippedProps,
        table,
      });
      const nextProps = {
        ...baseProps,
        data: table,
        ...boundProps,
      };

      return rewriteGeoArrowAccessors({
        props: nextProps,
        table,
        layerName,
      });
    },
    postProcessConvertedJson: (json: unknown) => {
      if (
        json &&
        typeof json === 'object' &&
        'layers' in json &&
        Array.isArray((json as {layers?: unknown[]}).layers)
      ) {
        (json as {layers: unknown[]}).layers = (
          json as {layers: unknown[]}
        ).layers.filter(Boolean);
      }

      return json;
    },
  });
}
