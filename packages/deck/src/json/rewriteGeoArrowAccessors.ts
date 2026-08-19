import * as arrow from 'apache-arrow';
import {compileGeoArrowAccessor} from './compileGeoArrowAccessor';
import {getLayerCompatibility} from './layerCompatibility';

function isSimpleColumnReference(expression: string) {
  return /^[A-Za-z_$][\w$]*$/.test(expression.trim());
}

function canUseDirectVectorAccessor(propName: string, vector: arrow.Vector) {
  // H3 index columns are safe as Vectors — DeckH3HexagonLayer reads them
  // directly and converts BigInt → hex string when needed.
  if (propName === 'getHexagon') {
    const type = vector.type;
    return (
      arrow.DataType.isUtf8(type) ||
      arrow.DataType.isLargeUtf8(type) ||
      // DuckDB UBIGINT often arrives as Int(true, 64), not instanceof Int64.
      (arrow.DataType.isInt(type) && type.bitWidth === 64)
    );
  }

  const firstChunk = vector.data[0];
  if (!firstChunk) {
    return false;
  }

  // Heatmap weights are a scalar column. Passing the Vector through lets the
  // GeoArrow heatmap put them in binary attributes instead of a new function
  // on every JSON convert (which would look like a data change).
  if (propName === 'getWeight') {
    return (
      arrow.DataType.isFloat(firstChunk.type) ||
      arrow.DataType.isInt(firstChunk.type)
    );
  }

  // Direct numeric vectors (for example `getRadius`) currently end up in deck's
  // binary attribute path and trigger `Float64Array` initialization failures in the
  // GeoArrow scatterplot wrapper. Re-test which direct vector accessors are safe
  // after verifying the 0.4.x runtime contract handles them correctly.
  if (!propName.endsWith('Color')) {
    return false;
  }

  return arrow.DataType.isFixedSizeList(firstChunk.type);
}

export function rewriteGeoArrowAccessors(options: {
  props: Record<string, unknown>;
  table: arrow.Table;
  layerName: string;
}) {
  const {props, table, layerName} = options;
  const compatibility = getLayerCompatibility(layerName);
  if (!compatibility || compatibility.representation !== 'geoarrow') {
    return props;
  }

  const nextProps = {...props};

  for (const [propName, propValue] of Object.entries(nextProps)) {
    if (
      typeof propValue !== 'string' ||
      !propValue.startsWith('@@=') ||
      !propName.startsWith('get')
    ) {
      continue;
    }

    const expression = propValue.slice(3);
    if (
      compatibility.vectorAccessorProps.includes(propName) &&
      isSimpleColumnReference(expression)
    ) {
      const vector = table.getChild(expression.trim());
      if (vector && canUseDirectVectorAccessor(propName, vector)) {
        nextProps[propName] = vector;
        continue;
      }
      if (!vector) {
        // Column not found — fall through to compileGeoArrowAccessor which
        // handles missing bindings gracefully (returns undefined per row).
        console.warn(
          `Column "${expression.trim()}" not found in dataset for accessor "${propName}".`,
        );
      }
    }

    // This custom compiler handles GeoArrow batch-oriented callbacks. The 0.4.x
    // layers call function accessors with {index, data: {data: batch}, target},
    // which this compiler produces.
    nextProps[propName] = compileGeoArrowAccessor(expression, table);
  }

  return nextProps;
}
