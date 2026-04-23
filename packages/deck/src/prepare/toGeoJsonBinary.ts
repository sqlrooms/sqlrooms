import {geojsonToBinary} from '@loaders.gl/gis';
import type * as arrow from 'apache-arrow';
import type {Feature, Geometry} from 'geojson';

type BuildBinaryGeoJsonDataOptions = {
  table: arrow.Table;
  geometryColumnName: string;
  getGeometryAt: (rowIndex: number) => unknown;
};

export function buildBinaryGeoJsonData(
  options: BuildBinaryGeoJsonDataOptions,
): unknown {
  const {table, geometryColumnName, getGeometryAt} = options;
  const propertyColumns = table.schema.fields
    .map((field) => field.name)
    .filter((fieldName) => fieldName !== geometryColumnName);

  const propertyVectors = propertyColumns.map((name) => table.getChild(name));

  const features: Feature<Geometry>[] = [];
  for (let rowIndex = 0; rowIndex < table.numRows; rowIndex++) {
    const geometry = getGeometryAt(rowIndex);
    if (!geometry) {
      continue;
    }

    const properties: Record<string, unknown> = {};
    for (let i = 0; i < propertyColumns.length; i++) {
      properties[propertyColumns[i]!] = propertyVectors[i]?.get(rowIndex);
    }

    features.push({
      type: 'Feature',
      geometry: geometry as Geometry,
      properties,
    });
  }

  return geojsonToBinary(features);
}
