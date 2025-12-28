import {
  Table,
  vectorFromArray,
  FixedSizeList,
  Float64,
  Field,
} from 'apache-arrow';

/**
 * Constructs a GeoArrow-compatible Table from individual Arrow vectors.
 *
 * DuckDB-WASM typically exports geometry as WKB (Well-Known Binary). Since
 * WKB-to-GeoArrow parsing in geoarrow-js is not yet supported,
 * we're adding this utility function as a bridge between Arrow Tables and GeoArrow.
 *
 * Ideally, this function can be replaced with a proper GeoArrow Table constructor in the future.
 * See: https://github.com/geoarrow/geoarrow-js/issues/42
 *
 * @param latVector - Arrow vector of latitudes
 * @param lonVector - Arrow vector of longitudes
 * @param magVector - Arrow vector of magnitudes
 * @param depthVector - Arrow vector of depths
 * @param dateVector - Arrow vector of date-times
 * @returns A GeoArrow-compliant Table with geometry and associated attributes.
 */
export function buildGeoArrowPointTable(
  latVector: any,
  lonVector: any,
  magVector: any,
  depthVector: any,
  dateVector: any,
) {
  const lats = latVector.toArray();
  const lons = lonVector.toArray();
  const mags = magVector.toArray();
  const depths = depthVector.toArray();
  const dates = dateVector.toArray();

  const rowCount = lats.length;

  const points = new Array(rowCount);
  for (let i = 0; i < rowCount; i++) {
    points[i] = [lons[i], lats[i]];
  }

  const childField = new Field('xy', new Float64());
  const geomType = new FixedSizeList(2, childField);
  const geomCol = vectorFromArray(points, geomType);

  const magCol = vectorFromArray(mags);
  const depthCol = vectorFromArray(depths);
  const dateCol = vectorFromArray(dates);

  return new Table({
    Magnitude: magCol,
    Depth: depthCol,
    DateTime: dateCol,
    geom: geomCol,
  });
}
