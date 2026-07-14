/**
 * Component that renders Cesium entities from SQL query results.
 * Bridges DuckDB data to 3D globe visualization.
 */

import React, {useEffect} from 'react';
import {Entity, PointGraphics} from 'resium';
import {Color, HeightReference} from 'cesium';
import {useSql} from '@sqlrooms/duckdb';
import type {CesiumLayerConfig} from '../cesium-config';
import {useStoreWithCesium} from '../cesium-slice';
import {useSqlToCesiumEntities} from '../hooks/useSqlToCesiumEntities';

export interface CesiumEntityLayerProps {
  /** Layer configuration with SQL query and column mappings */
  layerConfig: CesiumLayerConfig;
}

/**
 * Executes a SQL query and renders each row as a Cesium Entity.
 *
 * Column mapping determines which columns map to lon/lat/alt/time/label/color/size.
 * Follows the vega pattern: useSql hook for data fetching, useMemo for conversion.
 *
 * **Performance**: Uses useMemo to prevent entity recreation on every render.
 * Only recomputes when SQL data changes.
 *
 * @example
 * ```typescript
 * <CesiumEntityLayer
 *   layerConfig={{
 *     id: 'earthquakes',
 *     type: 'sql-entities',
 *     sqlQuery: 'SELECT * FROM earthquakes WHERE mag > 5',
 *     columnMapping: {
 *       longitude: 'lon',
 *       latitude: 'lat',
 *       label: 'place',
 *       size: 'mag'
 *     }
 *   }}
 * />
 * ```
 */
export const CesiumEntityLayer: React.FC<CesiumEntityLayerProps> = ({
  layerConfig,
}) => {
  const {sqlQuery, tableName} = layerConfig;

  // Gate query on table existence (follows deckgl pattern)
  // Without this, useSql fires immediately and fails with "table not found"
  // because data sources haven't finished loading into DuckDB yet.
  // useSql does NOT auto-retry on failure.
  const table = useStoreWithCesium((s) =>
    tableName ? s.db.findTableByName(tableName) : true,
  );

  const {data, isLoading, error} = useSql<Record<string, any>>({
    query: sqlQuery ?? '',
    enabled: Boolean(sqlQuery) && Boolean(table),
  });

  // Convert Arrow table rows to entity descriptors
  const entities = useSqlToCesiumEntities(data?.toArray() ?? [], layerConfig);

  // Map config string to Cesium HeightReference enum
  const heightRef =
    layerConfig.heightReference === 'CLAMP_TO_GROUND'
      ? HeightReference.CLAMP_TO_GROUND
      : layerConfig.heightReference === 'NONE'
        ? HeightReference.NONE
        : HeightReference.RELATIVE_TO_GROUND;

  // Auto-sync the clock range to the data whenever the data changes. Run on
  // every data change (not just the first) so that a caller updating the
  // layer's SQL query — e.g. activating a spatial filter — immediately
  // reparks the clock on the new dataset's time bounds. Without this, a
  // stale `currentTime` from the previous dataset can fall outside every new
  // entity's `[event_time, stopTime]` availability window, hiding all of them.
  const setClockConfig = useStoreWithCesium((s) => s.cesium.setClockConfig);
  const setCurrentTime = useStoreWithCesium((s) => s.cesium.setCurrentTime);

  useEffect(() => {
    if (entities.length === 0) return;

    const timeEntities = entities.filter((e) => e.time);
    if (timeEntities.length === 0) return;

    // Entities are not guaranteed to arrive sorted; scan for the true range.
    let startTime = timeEntities[0]!.time!;
    let stopTime = startTime;
    for (const e of timeEntities) {
      const t = e.time!;
      if (t < startTime) startTime = t;
      if (t > stopTime) stopTime = t;
    }

    setClockConfig({startTime, stopTime});
    // Park the clock at the end of the range so the full cumulative catalog
    // is visible at load. Entities use `[event_time, stopTime]` availability
    // (see useSqlToCesiumEntities), so `currentTime = stopTime` keeps every
    // event in view; scrubbing backward reveals the temporal history.
    setCurrentTime(stopTime);
  }, [entities, setClockConfig, setCurrentTime]);

  // Don't render if loading, error, or no data
  if (isLoading || error || !entities.length) {
    return null;
  }

  // Render each entity as a Resium Entity component
  return (
    <>
      {entities.map((entity) => (
        <Entity
          key={entity.id}
          name={entity.label ?? entity.id}
          position={entity.position}
          description={entity.label}
          availability={entity.availability}
        >
          <PointGraphics
            pixelSize={entity.size ? entity.size * 2 : 8}
            color={
              entity.color ? Color.fromCssColorString(entity.color) : Color.CYAN
            }
            heightReference={heightRef}
            outlineColor={Color.WHITE}
            outlineWidth={1}
          />
        </Entity>
      ))}
    </>
  );
};
