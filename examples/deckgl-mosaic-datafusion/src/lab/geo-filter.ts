import {
  add,
  and,
  column,
  isBetween,
  lte,
  mul,
  sub,
  type ExprNode,
} from '@uwdata/mosaic-sql';
import {BOUNDS} from './types';

export type GeoCircle = {
  center: {lon: number; lat: number};
  radiusKm: number;
};

const KM_PER_DEGREE_LAT = 111.32;

/**
 * Builds a circle predicate over the lon/lat columns of the
 * cells_current_lead table.
 * The map hover brush publishes it into the shared Mosaic selection. The
 * predicate combines a bounding box test with a squared distance test in
 * km using a local equirectangular approximation.
 */
export function geoCirclePredicateExpr({
  center,
  radiusKm,
}: GeoCircle): ExprNode {
  const kmPerDegreeLon = Math.max(
    1,
    KM_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180),
  );
  const west = Math.max(BOUNDS.west, center.lon - radiusKm / kmPerDegreeLon);
  const east = Math.min(BOUNDS.east, center.lon + radiusKm / kmPerDegreeLon);
  const south = Math.max(
    BOUNDS.south,
    center.lat - radiusKm / KM_PER_DEGREE_LAT,
  );
  const north = Math.min(
    BOUNDS.north,
    center.lat + radiusKm / KM_PER_DEGREE_LAT,
  );
  const latKm = mul(sub(column('lat'), center.lat), KM_PER_DEGREE_LAT);
  const lonKm = mul(sub(column('lon'), center.lon), kmPerDegreeLon);
  return and(
    isBetween(column('lon'), [west, east]),
    isBetween(column('lat'), [south, north]),
    lte(add(mul(latKm, latKm), mul(lonKm, lonKm)), radiusKm * radiusKm),
  );
}
