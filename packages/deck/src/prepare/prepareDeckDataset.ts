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
