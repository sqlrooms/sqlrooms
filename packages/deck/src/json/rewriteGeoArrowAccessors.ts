import type * as arrow from 'apache-arrow';
import {compileGeoArrowAccessor} from './compileGeoArrowAccessor';
import {getLayerCompatibility} from './layerCompatibility';

function isSimpleColumnReference(expression: string) {
  return /^[A-Za-z_$][\w$]*$/.test(expression.trim());
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
      if (vector) {
        nextProps[propName] = vector;
        continue;
      }
    }

    nextProps[propName] = compileGeoArrowAccessor(expression, table);
  }

  return nextProps;
}
