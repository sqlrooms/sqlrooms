/**
 * Hook for converting SQL query results to Cesium entity descriptors.
 * Provides a reusable pattern for SQL → visualization data bridge.
 */

import {useMemo} from 'react';
import {
  CallbackProperty,
  Cartesian3,
  ExtrapolationType,
  HeadingPitchRoll,
  JulianDate,
  type PositionProperty,
  type Property,
  Quaternion,
  SampledPositionProperty,
  SampledProperty,
  TimeInterval,
  TimeIntervalCollection,
  VelocityOrientationProperty,
} from 'cesium';
import type {CesiumLayerConfig} from '../cesium-config';
import {toIso8601} from '../utils';

/**
 * Entity descriptor for rendering.
 * Simplified interface for creating Cesium entities from data rows.
 */
export interface CesiumEntityDescriptor {
  id: string;
  position: ReturnType<typeof Cartesian3.fromDegrees> | PositionProperty;
  label?: string;
  time?: string;
  /** If set, entity is only visible during this time interval */
  availability?: TimeIntervalCollection;
  color?: string;
  size?: number;
  heading?: number;
  rotation?: Property;
  orientation?: Property;
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
  return useMemo(() => {
    if (!rows || rows.length === 0) return [];

    const mapping = layerConfig.columnMapping ?? {
      longitude: 'longitude',
      latitude: 'latitude',
    };
    const entityIdColumn = mapping.id;
    const modelOrientationOffset = layerConfig.modelOrientationOffset;
    const hasModelOrientationOffset =
      modelOrientationOffset.heading !== 0 ||
      modelOrientationOffset.pitch !== 0 ||
      modelOrientationOffset.roll !== 0;
    const orientationOffsetQuat = hasModelOrientationOffset
      ? Quaternion.fromHeadingPitchRoll(
          new HeadingPitchRoll(
            (modelOrientationOffset.heading * Math.PI) / 180,
            (modelOrientationOffset.pitch * Math.PI) / 180,
            (modelOrientationOffset.roll * Math.PI) / 180,
          ),
        )
      : undefined;

    // Pre-compute the latest timestamp across all rows for availability intervals.
    // Entities appear at their timestamp and remain visible until the end.
    // We scan all rows instead of assuming sorted order.
    let stopJd: InstanceType<typeof JulianDate> | undefined;
    if (mapping.time) {
      for (const row of rows) {
        const raw = row[mapping.time];
        if (raw == null) continue;
        try {
          const jd = JulianDate.fromIso8601(toIso8601(String(raw)));
          if (!stopJd || JulianDate.greaterThan(jd, stopJd)) {
            stopJd = jd;
          }
        } catch {
          /* skip unparseable timestamps */
        }
      }
    }

    const staticDescriptors: CesiumEntityDescriptor[] = [];
    const dynamicRows = new Map<
      string,
      {
        label?: string;
        color?: string;
        size?: number;
        samples: {
          time: string;
          jd: InstanceType<typeof JulianDate>;
          position: ReturnType<typeof Cartesian3.fromDegrees>;
          heading?: number;
        }[];
      }
    >();

    rows.forEach((row: any, i: number) => {
      const lon = Number(row[mapping.longitude]);
      const lat = Number(row[mapping.latitude]);
      const alt = mapping.altitude ? Number(row[mapping.altitude]) : 0;

      // Skip rows with invalid/missing coordinates — Cartesian3.fromDegrees
      // silently accepts NaN and produces corrupt entities.
      if (
        !Number.isFinite(lon) ||
        !Number.isFinite(lat) ||
        !Number.isFinite(alt)
      ) {
        return;
      }

      let timeStr: string | undefined;
      if (mapping.time) {
        const rawTime = row[mapping.time];
        if (rawTime == null) return;
        try {
          timeStr = toIso8601(String(rawTime));
          // Validate the ISO string actually parses.
          JulianDate.fromIso8601(timeStr);
        } catch {
          return;
        }
      }

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

      const labelVal = mapping.label ? row[mapping.label] : undefined;
      const colorVal = mapping.color ? row[mapping.color] : undefined;
      const sizeVal = mapping.size ? Number(row[mapping.size]) : undefined;
      const headingVal = mapping.heading
        ? Number(row[mapping.heading])
        : undefined;
      const position = Cartesian3.fromDegrees(lon, lat, alt);
      const entityId =
        entityIdColumn && row[entityIdColumn] != null
          ? String(row[entityIdColumn])
          : undefined;

      if (entityId && timeStr) {
        const group = dynamicRows.get(entityId) ?? {
          label: labelVal != null ? String(labelVal) : undefined,
          color: colorVal != null ? String(colorVal) : undefined,
          size: Number.isFinite(sizeVal) ? sizeVal : undefined,
          samples: [],
        };
        group.samples.push({
          time: timeStr,
          jd: JulianDate.fromIso8601(timeStr),
          position,
          heading: Number.isFinite(headingVal) ? headingVal : undefined,
        });
        if (group.label == null && labelVal != null) {
          group.label = String(labelVal);
        }
        if (group.color == null && colorVal != null) {
          group.color = String(colorVal);
        }
        if (group.size == null && Number.isFinite(sizeVal)) {
          group.size = sizeVal;
        }
        dynamicRows.set(entityId, group);
        return;
      }

      staticDescriptors.push({
        id: `${layerConfig.id}-${i}`,
        position,
        label: labelVal != null ? String(labelVal) : undefined,
        time: timeStr,
        availability,
        color: colorVal != null ? String(colorVal) : undefined,
        size: Number.isFinite(sizeVal) ? sizeVal : undefined,
        heading: Number.isFinite(headingVal) ? headingVal : undefined,
      });
    });

    const dynamicDescriptors: CesiumEntityDescriptor[] = [];
    dynamicRows.forEach((group, entityId) => {
      if (group.samples.length === 0) return;

      group.samples.sort((a, b) => JulianDate.compare(a.jd, b.jd));
      const position = new SampledPositionProperty();
      position.forwardExtrapolationType = ExtrapolationType.NONE;
      position.backwardExtrapolationType = ExtrapolationType.NONE;

      const rotation = new SampledProperty(Number);
      let previousRotation: number | undefined;

      for (const sample of group.samples) {
        position.addSample(sample.jd, sample.position);
        const sampleRotation =
          sample.heading != null
            ? (-sample.heading * Math.PI) / 180
            : previousRotation;
        if (sampleRotation != null) {
          rotation.addSample(sample.jd, sampleRotation);
          previousRotation = sampleRotation;
        }
      }

      const start = group.samples[0]?.jd;
      const stop = group.samples[group.samples.length - 1]?.jd;
      if (!start || !stop) return;

      const baseOrientation = new VelocityOrientationProperty(position);
      const orientation =
        orientationOffsetQuat != null
          ? new CallbackProperty((time, result) => {
              const base = baseOrientation.getValue(time);
              if (!base) return undefined;
              return Quaternion.multiply(base, orientationOffsetQuat, result);
            }, false)
          : baseOrientation;

      dynamicDescriptors.push({
        id: `${layerConfig.id}-${entityId}`,
        position,
        label: group.label,
        time: group.samples[0]?.time,
        availability: new TimeIntervalCollection([
          new TimeInterval({start, stop}),
        ]),
        color: group.color,
        size: group.size,
        rotation: previousRotation != null ? rotation : undefined,
        orientation,
      });
    });

    return [...dynamicDescriptors, ...staticDescriptors];
  }, [rows, layerConfig.columnMapping, layerConfig.id]);
}
