import * as arrow from 'apache-arrow';

/**
 * Builds a GeoArrow FixedSizeList<2, Float64> point vector from separate
 * longitude and latitude Arrow vectors. Each row becomes a [lon, lat] point.
 */
export function synthesizePointVector(
  lonVector: arrow.Vector,
  latVector: arrow.Vector,
  numRows: number,
): arrow.Vector {
  const flatCoords = new Float64Array(numRows * 2);
  for (let i = 0; i < numRows; i++) {
    flatCoords[i * 2] = Number(lonVector.get(i)) || 0;
    flatCoords[i * 2 + 1] = Number(latVector.get(i)) || 0;
  }

  const coordField = new arrow.Field('xy', new arrow.Float64(), false);
  const pointType = new arrow.FixedSizeList(2, coordField);
  const floatData = arrow.makeData({
    type: new arrow.Float64(),
    length: numRows * 2,
    data: flatCoords,
  });
  const pointData = arrow.makeData({
    type: pointType,
    length: numRows,
    child: floatData,
  });

  return new arrow.Vector([pointData]);
}
