import {CompositeLayer, type Layer, type LayersList} from '@deck.gl/core';
import {TripsLayer} from '@deck.gl/geo-layers';
import * as arrow from 'apache-arrow';

type TypedArray =
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Float32Array
  | Float64Array;

/**
 * Expand a per-geometry array to per-coordinate by repeating values for each
 * vertex in the geometry (required by deck.gl's binary attribute interface for
 * per-path attributes like getColor on PathLayer/TripsLayer).
 */
function expandToCoords<T extends TypedArray>(
  input: T,
  size: number,
  geomOffsets: Int32Array,
): T {
  const numCoords = geomOffsets[geomOffsets.length - 1]!;
  // @ts-expect-error constructor signature
  const output: T = new input.constructor(numCoords * size);
  for (let geomIdx = 0; geomIdx < geomOffsets.length - 1; geomIdx++) {
    const start = geomOffsets[geomIdx]!;
    const end = geomOffsets[geomIdx + 1]!;
    for (let coordIdx = start; coordIdx < end; coordIdx++) {
      for (let i = 0; i < size; i++) {
        output[coordIdx * size + i] = input[geomIdx * size + i]!;
      }
    }
  }
  return output;
}

/**
 * Custom GeoArrow-compatible TripsLayer wrapper.
 *
 * GeoArrowTripsLayer from @geoarrow/deck.gl-layers@0.3.2 was incompatible with
 * deck.gl 9.3.x: it passes the raw timestamps typed array via binary attributes,
 * but deck.gl 9.3's PathLayer/TripsLayer attribute manager fails to initialize
 * them correctly, producing "Float64Array Error: Float64Array".
 *
 * This wrapper extracts the binary data from Arrow vectors and passes it to the
 * native TripsLayer in a compatible format, properly resolving accessor props
 * (Arrow Vectors → binary attributes, functions → wrapped with batch context).
 */
export class DeckTripsLayer extends CompositeLayer<{
  data: arrow.Table;
  getPath: arrow.Vector;
  getTimestamps: arrow.Vector;
  getColor?:
    | arrow.Vector
    | [number, number, number, number]
    | ((...args: any[]) => any);
  getWidth?: arrow.Vector | number | ((...args: any[]) => any);
  currentTime?: number;
  trailLength?: number;
  fadeTrail?: boolean;
  widthMinPixels?: number;
  widthMaxPixels?: number;
  opacity?: number;
  _tripsMaxTimestamp?: number;
  [key: string]: unknown;
}> {
  static layerName = 'GeoArrowTripsLayer';
  static defaultProps = {
    currentTime: {type: 'number', value: 0},
    trailLength: {type: 'number', value: 120},
    fadeTrail: true,
    _pathType: 'open',
  };

  renderLayers(): Layer | LayersList | null {
    const {data: table, getPath, getTimestamps, ...otherProps} = this.props;

    if (!getPath || !getTimestamps) return null;

    const layers: TripsLayer[] = [];
    const numChunks = getPath.data.length;

    for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
      const lineData = getPath.data[chunkIdx];
      if (!lineData) continue;

      const geomOffsets = lineData.valueOffsets;
      const vertexData = lineData.children[0];
      if (!vertexData) continue;
      const nDim = (vertexData.type as arrow.FixedSizeList).listSize;
      const coordData = vertexData.children[0];
      if (!coordData) continue;

      // Arrow chunks may share a single backing buffer with absolute offsets.
      // deck.gl expects relative (zero-based) offsets for startIndices.
      const baseOffset = geomOffsets[0] ?? 0;
      const relativeOffsets = new Int32Array(geomOffsets.length);
      for (let i = 0; i < geomOffsets.length; i++) {
        relativeOffsets[i] = (geomOffsets[i] ?? 0) - baseOffset;
      }
      const numVertices = relativeOffsets[relativeOffsets.length - 1] ?? 0;

      // Slice the coordinate buffer to only this chunk's vertices
      const rawValues = coordData.values;
      const coordStart = baseOffset * nDim;
      const coordEnd = coordStart + numVertices * nDim;
      const flatCoords =
        coordStart > 0 || coordEnd < rawValues.length
          ? rawValues.slice(coordStart, coordEnd)
          : rawValues;

      const tsData = getTimestamps.data[chunkIdx];
      if (!tsData) continue;
      const tsChild = tsData.children[0];
      if (!tsChild) continue;

      // Slice timestamps to this chunk's range (same shared-buffer issue)
      const tsBaseOffset = tsData.valueOffsets[0] ?? 0;
      const tsRawValues = tsChild.values;
      const tsStart = tsBaseOffset;
      const tsEnd = tsStart + numVertices;

      // TripsLayer's timestamps attribute does NOT have doublePrecision, so
      // luma.gl's type resolver rejects Float64Array. Timestamps MUST be Float32.
      let tsValues: Float32Array;
      if (tsRawValues instanceof Float32Array) {
        tsValues = tsRawValues.slice(tsStart, tsEnd);
      } else {
        tsValues = new Float32Array(numVertices);
        const src = tsRawValues;
        if (src instanceof BigInt64Array || src instanceof BigUint64Array) {
          for (let i = 0; i < numVertices; i++) {
            tsValues[i] = Number(src[tsStart + i]);
          }
        } else {
          for (let i = 0; i < numVertices; i++) {
            tsValues[i] = Number(src[tsStart + i]) || 0;
          }
        }
      }

      const {_tripsMaxTimestamp: _unused, ...restProps} = otherProps;
      void _unused;

      const binaryAttributes: Record<
        string,
        {value: TypedArray; size: number; normalized?: boolean}
      > = {
        getPath: {value: flatCoords, size: nDim},
        getTimestamps: {value: tsValues, size: 1},
      };

      const layerProps: Record<string, unknown> = {};
      const batch = table.batches[chunkIdx];

      for (const [propName, propValue] of Object.entries(restProps)) {
        if (propValue instanceof arrow.Vector) {
          // Arrow Vector accessor → resolve to binary attribute
          const chunkData = propValue.data[chunkIdx];
          if (!chunkData) continue;

          if (arrow.DataType.isFixedSizeList(chunkData.type)) {
            const childValues = chunkData.children[0]?.values;
            if (!childValues) continue;
            const values = expandToCoords(
              childValues as TypedArray,
              chunkData.type.listSize,
              relativeOffsets,
            );
            binaryAttributes[propName] = {
              value: values,
              size: chunkData.type.listSize,
              normalized: true,
            };
          } else if (arrow.DataType.isFloat(chunkData.type)) {
            const values = expandToCoords(
              chunkData.values as TypedArray,
              1,
              relativeOffsets,
            );
            binaryAttributes[propName] = {value: values, size: 1};
          }
        } else if (typeof propValue === 'function') {
          // Function accessor → wrap to provide batch context
          const fn = propValue;
          layerProps[propName] = (
            _object: unknown,
            objectInfo: {index: number; target?: number[]},
          ) => {
            return fn({
              index: objectInfo.index,
              data: {data: batch},
              target: objectInfo.target,
            });
          };
        } else {
          layerProps[propName] = propValue;
        }
      }

      const props = {
        ...layerProps,
        _pathType: 'open' as const,
        id: `${this.props.id}-geoarrow-trip-${chunkIdx}`,
        data: {
          data: batch,
          length: lineData.length,
          startIndices: relativeOffsets,
          attributes: binaryAttributes,
        },
      };

      layers.push(new TripsLayer(props as any));
    }

    return layers;
  }
}
