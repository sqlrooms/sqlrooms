import type * as arrow from 'apache-arrow';
import {detectGeometryColumn} from './detectGeometryColumn';
import {
  buildNativeGeoArrowBinaryData,
  isDirectGeoArrowEncoding,
} from './geoarrow';
import type {
  GeometryEncodingHint,
  PreparedDeckDataset,
  PreparedGeoArrowLayerData,
  ResolvedGeometryColumn,
} from './types';
import {wkbGeometryDecoder} from './wkbDecoder';

type PrepareDeckDatasetOptions = {
  datasetId: string;
  table: arrow.Table;
  geometryColumn?: string;
  geometryEncodingHint?: GeometryEncodingHint;
};

/**
 * Build the reusable deck-facing geometry helpers for one resolved Arrow table.
 *
 * This is the expensive preparation step that `preparedDatasetStore` caches.
 * It accepts one resolved Arrow table plus a geometry column/hint and turns
 * the source geometry into canonical deck-facing outputs that can be reused by
 * multiple layers and multiple `DeckJsonMap` instances.
 *
 * Supported input geometry forms:
 *
 * - native GeoArrow columns
 *   Already columnar and geometry-aware. These are the cheapest inputs:
 *   preparation mainly does geometry-column detection plus lightweight wrapper
 *   shaping so GeoArrow-capable deck layers can consume the Arrow table/vector
 *   directly.
 * - WKB / GeoArrow WKB columns
 *   Binary geometry needs decoding because deck layers cannot render raw WKB
 *   bytes. Preparation promotes the binary values into deck-ready geometry
 *   structures for GeoArrow layers and GeoJSON-binary fallback layers.
 * - WKT / GeoArrow WKT columns
 *   Text geometry likewise needs parsing before deck can render it. This has a
 *   similar cost profile to WKB, but starts from text parsing rather than
 *   binary decoding.
 *
 * These transformations are necessary because the input table shape is chosen
 * by the query/data source, while deck expects render-oriented geometry
 * payloads. The canonical outputs produced here are:
 *
 * - GeoArrow layer data
 *   A `PreparedGeoArrowLayerData` payload for GeoArrow-native deck layers,
 *   either forwarded directly from native GeoArrow inputs or promoted from
 *   WKB/WKT into a GeoArrow-like representation.
 * - GeoJSON-binary data
 *   A binary GeoJSON-style payload for layers such as `GeoJsonLayer` that do
 *   not consume GeoArrow inputs directly.
 *
 * The returned object also memoizes:
 *
 * - geometry column detection
 * - GeoArrow layer payloads
 * - GeoJSON-binary fallbacks
 *
 * Caching at this level lets deck reuse geometry decoding and shaping work
 * even when the upstream query result is already cached by another system such
 * as Mosaic's query manager.
 */
export function prepareDeckDataset(
  options: PrepareDeckDatasetOptions,
): PreparedDeckDataset {
  const {datasetId, table, geometryColumn, geometryEncodingHint} = options;
  const resolvedGeometryCache = new Map<string, ResolvedGeometryColumn>();
  const geoArrowCache = new Map<string, PreparedGeoArrowLayerData>();
  const geoJsonBinaryCache = new Map<string, unknown>();

  const resolveGeometry = (geometryColumnOverride?: string) => {
    const cacheKey = geometryColumnOverride ?? '__default__';
    const cached = resolvedGeometryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const resolved = detectGeometryColumn({
      table,
      geometryColumn: geometryColumnOverride ?? geometryColumn,
      geometryEncodingHint,
    });
    resolvedGeometryCache.set(cacheKey, resolved);
    return resolved;
  };

  return {
    datasetId,
    table,
    datasetGeometryColumn: geometryColumn,
    resolveGeometry,
    getGeoArrowLayerData(geometryColumnOverride?: string) {
      const cacheKey = geometryColumnOverride ?? '__default__';
      const cached = geoArrowCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const resolved = resolveGeometry(geometryColumnOverride);
      let prepared: PreparedGeoArrowLayerData;

      if (isDirectGeoArrowEncoding(resolved.encoding)) {
        prepared = {
          table,
          geometryColumnName: resolved.columnName,
          geometryColumn: resolved.vector,
          encoding: resolved.encoding,
          source: 'native',
        };
      } else {
        prepared = wkbGeometryDecoder.toGeoArrowLike(
          table,
          resolved.columnName,
          resolved.encoding,
        );
      }

      geoArrowCache.set(cacheKey, prepared);
      return prepared;
    },
    getGeoJsonBinaryData(geometryColumnOverride?: string) {
      const cacheKey = geometryColumnOverride ?? '__default__';
      const cached = geoJsonBinaryCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const resolved = resolveGeometry(geometryColumnOverride);
      const binaryData = resolved.nativeGeoArrow
        ? buildNativeGeoArrowBinaryData(table, resolved)
        : wkbGeometryDecoder.toGeoJsonBinary(
            table,
            resolved.columnName,
            resolved.encoding,
          );

      geoJsonBinaryCache.set(cacheKey, binaryData);
      return binaryData;
    },
  };
}
