/**
 * Component that renders Cesium entities from SQL query results.
 * Bridges DuckDB data to 3D globe visualization.
 */

import React, {useEffect, useRef} from 'react';
import {
  BillboardGraphics,
  BoxGraphics,
  Entity,
  ModelGraphics,
  PointGraphics,
} from 'resium';
import {
  Cartesian3,
  Color,
  HeightReference,
  JulianDate,
  Math as CesiumMath,
} from 'cesium';
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
  const setIsLoadingData = useStoreWithCesium((s) => s.cesium.setIsLoadingData);
  const setLayerEntityCount = useStoreWithCesium(
    (s) => s.cesium.setLayerEntityCount,
  );
  const configuredCurrentTime = useStoreWithCesium(
    (s) => s.cesium.config.clock.currentTime,
  );
  const hasSetClockRef = useRef(false);

  useEffect(() => {
    if (!sqlQuery || !table) {
      setIsLoadingData(false);
      setLayerEntityCount(layerConfig.id, 0);
      return;
    }

    setIsLoadingData(isLoading);

    return () => {
      setIsLoadingData(false);
      setLayerEntityCount(layerConfig.id, 0);
    };
  }, [
    isLoading,
    layerConfig.id,
    setIsLoadingData,
    setLayerEntityCount,
    sqlQuery,
    table,
  ]);

  useEffect(() => {
    if (isLoading || error || entities.length === 0 || !configuredCurrentTime) {
      setLayerEntityCount(layerConfig.id, 0);
      return;
    }

    let currentTime: JulianDate;

    try {
      currentTime = JulianDate.fromIso8601(configuredCurrentTime);
    } catch {
      setLayerEntityCount(layerConfig.id, 0);
      return;
    }

    const activeCount = entities.reduce((count, entity) => {
      if (!entity.availability) {
        return count + 1;
      }
      return entity.availability.contains(currentTime) ? count + 1 : count;
    }, 0);

    setLayerEntityCount(layerConfig.id, activeCount);
  }, [
    configuredCurrentTime,
    entities,
    error,
    isLoading,
    layerConfig.id,
    setLayerEntityCount,
  ]);

  useEffect(() => {
    if (hasSetClockRef.current || entities.length === 0) return;

    // Find time bounds from entities (data is ORDER BY time from SQL)
    const timeEntities = entities.filter((e) => e.time);
    if (timeEntities.length === 0) return;

    const startTime = timeEntities[0]!.time!;
    const stopTime = timeEntities[timeEntities.length - 1]!.time!;

    setClockConfig({startTime, stopTime});
    setCurrentTime(configuredCurrentTime ?? startTime);
    hasSetClockRef.current = true;
  }, [configuredCurrentTime, entities, setClockConfig, setCurrentTime]);

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
          orientation={entity.orientation}
          description={entity.label}
          availability={entity.availability}
        >
          {layerConfig.entityStyle === 'billboard' &&
          layerConfig.billboardImage ? (
            <BillboardGraphics
              image={layerConfig.billboardImage}
              scale={
                entity.size
                  ? layerConfig.billboardScale * (entity.size / 4)
                  : layerConfig.billboardScale
              }
              color={
                entity.color
                  ? Color.fromCssColorString(entity.color)
                  : Color.CYAN
              }
              alignedAxis={Cartesian3.UNIT_Z}
              rotation={
                entity.rotation ??
                CesiumMath.toRadians(entity.heading ? -entity.heading : 0)
              }
              heightReference={heightRef}
            />
          ) : layerConfig.entityStyle === 'box' ? (
            <BoxGraphics
              dimensions={
                new Cartesian3(
                  (entity.size ? entity.size * 12000 : 36000) *
                    layerConfig.geometryScale,
                  (entity.size ? entity.size * 3200 : 9600) *
                    layerConfig.geometryScale,
                  (entity.size ? entity.size * 900 : 2700) *
                    layerConfig.geometryScale,
                )
              }
              material={
                entity.color
                  ? Color.fromCssColorString(entity.color)
                  : Color.CYAN
              }
              outline
              outlineColor={Color.WHITE.withAlpha(0.5)}
            />
          ) : layerConfig.entityStyle === 'model' && layerConfig.modelUri ? (
            <ModelGraphics
              uri={layerConfig.modelUri}
              scale={
                entity.size
                  ? layerConfig.modelScale * (entity.size / 4)
                  : layerConfig.modelScale
              }
              minimumPixelSize={layerConfig.modelMinimumPixelSize}
              maximumScale={20000}
              colorBlendAmount={0.25}
              color={
                entity.color
                  ? Color.fromCssColorString(entity.color)
                  : undefined
              }
            />
          ) : (
            <PointGraphics
              pixelSize={entity.size ? entity.size * 2 : 8}
              color={
                entity.color
                  ? Color.fromCssColorString(entity.color)
                  : Color.CYAN
              }
              heightReference={heightRef}
              outlineColor={Color.WHITE}
              outlineWidth={1}
            />
          )}
        </Entity>
      ))}
    </>
  );
};
