import type * as arrow from 'apache-arrow';
import type {PreparedGeoArrowLayerData, ResolvedGeometryEncoding} from './types';

export type SupportedGeoArrowLayerType =
  | 'GeoArrowScatterplotLayer'
  | 'GeoArrowPathLayer'
  | 'GeoArrowSolidPolygonLayer';

export type GeometryDecoder = {
  supportsGeoArrowPromotion: (
    layerType: SupportedGeoArrowLayerType,
    encoding: ResolvedGeometryEncoding,
    table: arrow.Table,
    columnName: string,
  ) => boolean;
  toGeoArrowLike: (
    table: arrow.Table,
    columnName: string,
    encoding: ResolvedGeometryEncoding,
  ) => PreparedGeoArrowLayerData;
  toGeoJsonBinary: (
    table: arrow.Table,
    columnName: string,
    encoding: ResolvedGeometryEncoding,
  ) => unknown;
};
