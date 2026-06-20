import * as arrow from 'apache-arrow';
import {compileGeoArrowAccessor} from './compileGeoArrowAccessor';
import {getLayerCompatibility} from './layerCompatibility';

function isSimpleColumnReference(expression: string) {
  return /^[A-Za-z_$][\w$]*$/.test(expression.trim());
}

function canUseDirectVectorAccessor(propName: string, vector: arrow.Vector) {
  // Direct numeric vectors (for example `getRadius`) currently end up in deck's
  // binary attribute path and trigger `Float64Array` initialization failures in the
  // GeoArrow scatterplot wrapper. Re-test which direct vector accessors are safe
  // after verifying the 0.4.x runtime contract handles them correctly.
  if (!propName.endsWith('Color')) {
    return false;
  }

  const firstChunk = vector.data[0];
  if (!firstChunk || !arrow.DataType.isFixedSizeList(firstChunk.type)) {
    return false;
  }

  return true;
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
        console.warn(
          `Column "${expression.trim()}" not found in dataset for accessor "${propName}". Skipping accessor.`,
        );
        delete nextProps[propName];
        continue;
      }
    }

    // This custom compiler handles GeoArrow batch-oriented callbacks. The 0.4.x
    // layers call function accessors with {index, data: {data: batch}, target},
    // which this compiler produces.
    nextProps[propName] = compileGeoArrowAccessor(expression, table);
  }

  return nextProps;
}
