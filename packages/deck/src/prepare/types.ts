import type * as arrow from 'apache-arrow';

export type GeometryEncodingHint = 'geoarrow' | 'wkb' | 'wkt';

export type ResolvedGeometryEncoding =
  | 'geoarrow.point'
  | 'geoarrow.multipoint'
  | 'geoarrow.linestring'
  | 'geoarrow.multilinestring'
  | 'geoarrow.polygon'
  | 'geoarrow.multipolygon'
  | 'geoarrow.wkb'
  | 'geoarrow.wkt'
  | 'wkb'
  | 'wkt'
  | 'unknown';

export type ResolvedGeometryColumn = {
  columnName: string;
  vector: arrow.Vector;
  encoding: ResolvedGeometryEncoding;
  nativeGeoArrow: boolean;
};

export type PreparedGeoArrowLayerData = {
  // TODO(geoarrow-upgrade): This `Table` + `Vector` payload shape matches published
  // `@geoarrow/deck.gl-layers@0.3.x`. Revisit it on the next GeoArrow bump; newer
  // versions may prefer RecordBatch/Data-chunk inputs instead of Table/Vector.
  table: arrow.Table;
  geometryColumnName: string;
  geometryColumn: arrow.Vector;
  encoding: ResolvedGeometryEncoding;
  source: 'native' | 'promoted';
};

export type PreparedDeckDataset = {
  datasetId: string;
  table: arrow.Table;
  datasetGeometryColumn?: string;
  resolveGeometry: (geometryColumn?: string) => ResolvedGeometryColumn;
  getGeoArrowLayerData: (geometryColumn?: string) => PreparedGeoArrowLayerData;
  getGeoJsonBinaryData: (geometryColumn?: string) => unknown;
};
