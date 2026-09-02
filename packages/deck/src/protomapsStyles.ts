import {layers, namedFlavor} from '@protomaps/basemaps';
import type {ResolvedTheme} from '@sqlrooms/ui';
import type {StyleSpecification} from 'maplibre-gl';

/** Supported Protomaps basemap color palettes. */
export type ProtomapsFlavor =
  | 'light'
  | 'dark'
  | 'white'
  | 'black'
  | 'grayscale';

/**
 * Creates a MapLibre style using the hosted Protomaps v4 vector tiles API.
 * The browser-visible API key should be scoped to the host application's origins.
 */
export function createProtomapsStyle(
  flavor: ProtomapsFlavor,
  apiKey: string,
): StyleSpecification {
  return {
    version: 8,
    glyphs:
      'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${flavor}`,
    sources: {
      protomaps: {
        type: 'vector',
        url: `https://api.protomaps.com/tiles/v4.json?key=${encodeURIComponent(apiKey)}`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> ' +
          '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: layers('protomaps', namedFlavor(flavor), {lang: 'en'}),
  };
}

/** Creates neutral light/dark basemaps for DeckMapDefaultStylesProvider. */
export function createProtomapsDefaultStyles(
  apiKey: string,
): Record<ResolvedTheme, StyleSpecification> {
  return {
    light: createProtomapsStyle('white', apiKey),
    dark: createProtomapsStyle('black', apiKey),
  };
}
