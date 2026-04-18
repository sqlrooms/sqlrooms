import * as arrow from 'apache-arrow';
import {compileGeoArrowAccessor} from './compileGeoArrowAccessor';
import {getLayerCompatibility} from './layerCompatibility';

function isSimpleColumnReference(expression: string) {
  return /^[A-Za-z_$][\w$]*$/.test(expression.trim());
}

function canUseDirectVectorAccessor(propName: string, vector: arrow.Vector) {
  // TODO(geoarrow-upgrade): This is intentionally conservative for published 0.3.x.
  // Direct numeric vectors (for example `getRadius`) currently end up in deck's
  // binary attribute path and trigger `Float64Array` initialization failures in the
  // GeoArrow scatterplot wrapper. Re-test which direct vector accessors are safe
  // after the next GeoArrow release and widen this gate if the runtime contract
  // improves.
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
    }

    // TODO(geoarrow-upgrade): This fallback exists because 0.3.x GeoArrow layers do
    // not share `@deck.gl/json`'s normal row accessor contract. If the next version
    // supports standard deck/json accessors, or offers native expression handling,
    // prefer that over our custom compiler.
    nextProps[propName] = compileGeoArrowAccessor(expression, table);
  }

  return nextProps;
}
