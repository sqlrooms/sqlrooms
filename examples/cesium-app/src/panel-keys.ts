/**
 * Stable panel keys used as mosaic layout node IDs and RoomPanel `type` props.
 * Kept in a dedicated file so layout panels can import the keys without
 * creating a circular dependency with `store.ts`.
 */

export const EarthquakePanels = {
  Presets: 'presets',
  Histogram: 'histogram',
} as const;

export type EarthquakePanelKey =
  (typeof EarthquakePanels)[keyof typeof EarthquakePanels];
