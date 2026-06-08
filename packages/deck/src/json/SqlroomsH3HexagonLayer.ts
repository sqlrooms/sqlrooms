import {CompositeLayer, type Layer, type LayersList} from '@deck.gl/core';
import {H3HexagonLayer} from '@deck.gl/geo-layers';
import * as arrow from 'apache-arrow';

/**
 * Custom GeoArrow-compatible H3HexagonLayer wrapper.
 *
 * GeoArrowH3HexagonLayer from @geoarrow/deck.gl-layers@0.3.2 is incompatible
 * with @deck.gl/geo-layers@9.3.x: the wrapper passes H3 indices via binary
 * attributes, but H3HexagonLayer internally iterates rows using createIterable
 * and calls getHexagon(object) expecting string H3 indices. This causes
 * "Cannot read properties of undefined" errors at runtime.
 *
 * This wrapper converts Arrow data to row objects with proper BigInt→hex string
 * conversion, then passes them to the native H3HexagonLayer.
 */
export class SqlroomsH3HexagonLayer extends CompositeLayer<{
  data: arrow.Table;
  getHexagon: arrow.Vector;
  getFillColor?: arrow.Vector | [number, number, number, number] | ((...args: any[]) => any);
  getElevation?: arrow.Vector | number | ((...args: any[]) => any);
  getLineColor?: arrow.Vector | [number, number, number, number] | ((...args: any[]) => any);
  getLineWidth?: arrow.Vector | number | ((...args: any[]) => any);
  [key: string]: unknown;
}> {
  static layerName = 'GeoArrowH3HexagonLayer';
  static defaultProps = {
    highPrecision: 'auto',
    coverage: {type: 'number', min: 0, max: 1, value: 1},
    extruded: true,
  };

  renderLayers(): Layer | LayersList | null {
    const {data: table, getHexagon: hexProp, ...otherProps} = this.props;

    if (!table || !hexProp) return null;

    const numRows = table.numRows;
    const isVector = hexProp instanceof arrow.Vector;
    const isBigIntColumn =
      isVector &&
      (hexProp.type instanceof arrow.Int64 ||
        hexProp.type instanceof arrow.Uint64);

    // Resolve hex value per row
    const getHexValue = (i: number): string => {
      if (isVector) {
        const raw = hexProp.get(i);
        if (isBigIntColumn && typeof raw === 'bigint') {
          return raw.toString(16);
        }
        return String(raw ?? '');
      }
      // Compiled accessor function
      if (typeof hexProp === 'function') {
        const result = (hexProp as Function)({
          index: i,
          data: {data: table.batches[0]},
          target: [],
        });
        if (typeof result === 'bigint') return result.toString(16);
        return String(result ?? '');
      }
      return '';
    };

    // Build row objects from Arrow table
    const rows: Record<string, unknown>[] = Array.from(
      {length: numRows},
      (_, i) => {
        const row: Record<string, unknown> = {};
        for (const field of table.schema.fields) {
          row[field.name] = table.getChild(field.name)?.get(i);
        }
        row.__h3Index = getHexValue(i);
        return row;
      },
    );

    // Resolve accessor props: Arrow Vectors → row functions, keep scalars
    const layerProps: Record<string, unknown> = {};
    for (const [propName, propValue] of Object.entries(otherProps)) {
      if (propValue instanceof arrow.Vector) {
        // Arrow Vector → row accessor (H3 layer uses row-based iteration)
        const vec = propValue;
        layerProps[propName] = (d: Record<string, unknown>, {index}: {index: number}) => {
          return vec.get(index);
        };
      } else if (typeof propValue === 'function') {
        // Compiled GeoArrow accessor → wrap with batch context
        const fn = propValue;
        layerProps[propName] = (
          _object: unknown,
          objectInfo: {index: number; target?: number[]},
        ) => {
          return fn({
            index: objectInfo.index,
            data: {data: table.batches[0]},
            target: objectInfo.target,
          });
        };
      } else {
        layerProps[propName] = propValue;
      }
    }

    return new H3HexagonLayer({
      ...layerProps,
      id: `${this.props.id}-geoarrow-h3`,
      data: rows,
      getHexagon: (d: Record<string, unknown>) => d.__h3Index as string,
    } as any);
  }
}
