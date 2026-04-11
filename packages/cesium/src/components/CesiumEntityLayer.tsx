/**
 * Component that renders Cesium entities from SQL query results.
 * Bridges DuckDB data to 3D globe visualization.
 */

import React, {useEffect, useRef} from 'react';
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

  // Auto-set clock time range from data when a time column is mapped
  const setClockConfig = useStoreWithCesium((s) => s.cesium.setClockConfig);
  const setCurrentTime = useStoreWithCesium((s) => s.cesium.setCurrentTime);
  const hasSetClockRef = useRef(false);

  useEffect(() => {
    if (hasSetClockRef.current || entities.length === 0) return;

    // Find time bounds from entities (data is ORDER BY time from SQL)
    const timeEntities = entities.filter((e) => e.time);
    if (timeEntities.length === 0) return;

    const startTime = timeEntities[0]!.time!;
    const stopTime = timeEntities[timeEntities.length - 1]!.time!;

    console.log('[CesiumEntityLayer] Setting clock range:', {
      startTime,
      stopTime,
      entityCount: entities.length,
      hasAvailability: !!entities[0]?.availability,
    });

    setClockConfig({startTime, stopTime});
    setCurrentTime(startTime);
    hasSetClockRef.current = true;
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
