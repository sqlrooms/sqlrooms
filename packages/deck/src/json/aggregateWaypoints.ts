import * as arrow from 'apache-arrow';

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
const TIMESTAMP_PATTERNS = [
  'timestamp',
  'timestamps',
  'time',
  't',
  'elapsed',
  'seconds',
  'ms',
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
 *
 * Also builds a timestamps list column if a timestamp-like column is found,
 * suitable for GeoArrowTripsLayer.
 */
export function tryAggregateWaypointsToLineStrings(
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
  const timestampCol = findColumnByPatterns(fieldNames, TIMESTAMP_PATTERNS);
  const excludeCols = new Set(
    [coords.lat, coords.lon, orderCol, timestampCol].filter(Boolean),
  );

  for (const field of table.schema.fields) {
    if (excludeCols.has(field.name)) continue;
    const srcVector = table.getChild(field.name)!;
    const values: unknown[] = [];
    for (const key of groupOrder) {
      const firstIdx = groups.get(key)!.indices[0]!;
      values.push(srcVector.get(firstIdx));
    }
    columns[field.name] = arrow.vectorFromArray(values);
  }
  columns['__geom'] = geometryVector;

  // Build timestamps list column if a timestamp column exists.
  // Must be a proper Arrow List<Float64> vector for GeoArrowTripsLayer.
  if (timestampCol) {
    const tsVector = table.getChild(timestampCol)!;
    const tsOffsets = new Int32Array(numPaths + 1);
    let tsTotalValues = 0;
    for (let g = 0; g < numPaths; g++) {
      tsOffsets[g] = tsTotalValues;
      tsTotalValues += groups.get(groupOrder[g]!)!.indices.length;
    }
    tsOffsets[numPaths] = tsTotalValues;

    const tsFlat = new Float64Array(tsTotalValues);
    let tsWriteIdx = 0;
    for (const key of groupOrder) {
      for (const rowIdx of groups.get(key)!.indices) {
        tsFlat[tsWriteIdx++] = Number(tsVector.get(rowIdx)) || 0;
      }
    }

    const tsValueField = new arrow.Field('', new arrow.Float64(), true);
    const tsListType = new arrow.List(tsValueField);
    const tsValuesData = arrow.makeData({
      type: new arrow.Float64(),
      length: tsTotalValues,
      data: tsFlat,
    });
    const tsListData = arrow.makeData({
      type: tsListType,
      length: numPaths,
      valueOffsets: tsOffsets,
      child: tsValuesData,
    });
    const tsListVector = new arrow.Vector([tsListData]);
    columns[timestampCol] = tsListVector;
    if (timestampCol !== 'timestamps') {
      columns['timestamps'] = tsListVector;
    }
  }

  const aggregatedTable = new arrow.Table(columns);
  return {table: aggregatedTable, geometryVector};
}
