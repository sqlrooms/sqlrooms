/**
 * Hook for converting SQL query results to Cesium entity descriptors.
 * Provides a reusable pattern for SQL → visualization data bridge.
 */

import {useMemo} from 'react';
import {
  Cartesian3,
  JulianDate,
  TimeInterval,
  TimeIntervalCollection,
} from 'cesium';
import type {CesiumLayerConfig} from '../cesium-config';
import {toIso8601} from '../utils';

/**
 * Entity descriptor for rendering.
 * Simplified interface for creating Cesium entities from data rows.
 */
export interface CesiumEntityDescriptor {
  id: string;
  position: ReturnType<typeof Cartesian3.fromDegrees>;
  label?: string;
  time?: string;
  /** If set, entity is only visible during this time interval */
  availability?: TimeIntervalCollection;
  color?: string;
  size?: number;
}

/**
 * Converts SQL query result rows to Cesium entity descriptors.
 * Handles column mapping and type coercion.
 *
 * @param rows Array of data rows from SQL query
 * @param layerConfig Layer configuration with column mappings
 * @returns Array of entity descriptors ready for rendering
 *
 * @example
 * ```typescript
 * const {data} = useSql({query: 'SELECT * FROM earthquakes'});
 * const entities = useSqlToCesiumEntities(
 *   data?.toArray() ?? [],
 *   layerConfig
 * );
 * ```
 */
export function useSqlToCesiumEntities(
  rows: any[],
  layerConfig: CesiumLayerConfig,
): CesiumEntityDescriptor[] {
  const mapping = layerConfig.columnMapping ?? {
    longitude: 'longitude',
    latitude: 'latitude',
  };

  return useMemo(() => {
    if (!rows || rows.length === 0) return [];

    // Pre-compute the stop time (last row's time) for availability intervals.
    // Entities appear at their timestamp and remain visible until the end.
    let stopJd: InstanceType<typeof JulianDate> | undefined;
    if (mapping.time) {
      const lastRow = rows[rows.length - 1];
      const lastTimeStr = lastRow ? String(lastRow[mapping.time]) : undefined;
      if (lastTimeStr) {
        try {
          stopJd = JulianDate.fromIso8601(toIso8601(lastTimeStr));
        } catch {
          /* invalid date — skip availability */
        }
      }
    }

    return rows.map((row: any, i: number) => {
      const lon = Number(row[mapping.longitude]);
      const lat = Number(row[mapping.latitude]);
      const alt = mapping.altitude ? Number(row[mapping.altitude]) : 0;

      const timeStr = mapping.time
        ? toIso8601(String(row[mapping.time]))
        : undefined;

      // Build availability interval: visible from event time to end of dataset
      let availability: TimeIntervalCollection | undefined;
      if (timeStr && stopJd) {
        try {
          const startJd = JulianDate.fromIso8601(timeStr);
          availability = new TimeIntervalCollection([
            new TimeInterval({start: startJd, stop: stopJd}),
          ]);
        } catch {
          /* invalid date — no filtering for this entity */
        }
      }

      return {
        id: `${layerConfig.id}-${i}`,
        position: Cartesian3.fromDegrees(lon, lat, alt),
        label: mapping.label ? String(row[mapping.label]) : undefined,
        time: timeStr,
        availability,
        color: mapping.color ? String(row[mapping.color]) : undefined,
        size: mapping.size ? Number(row[mapping.size]) : undefined,
      };
    });
  }, [rows, mapping, layerConfig.id]);
}
