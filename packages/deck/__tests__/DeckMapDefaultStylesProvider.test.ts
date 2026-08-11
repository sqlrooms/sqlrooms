import {describe, expect, test} from '@jest/globals';
import {
  isMapboxStyleUrl,
  resolveDeckMapStyle,
} from '../src/DeckMapDefaultStylesProvider';

const fallbackStyles = {
  light: 'fallback-light',
  dark: 'fallback-dark',
};

describe('resolveDeckMapStyle', () => {
  test('prefers explicit map styles over map props and host defaults', () => {
    expect(
      resolveDeckMapStyle({
        mapStyle: 'explicit',
        mapPropsMapStyle: 'map-props',
        hostDefaultStyles: {dark: 'host-dark'},
        resolvedTheme: 'dark',
        fallbackStyles,
      }),
    ).toBe('explicit');
  });

  test('uses map props before the host default', () => {
    expect(
      resolveDeckMapStyle({
        mapPropsMapStyle: 'map-props',
        hostDefaultStyles: {dark: 'host-dark'},
        resolvedTheme: 'dark',
        fallbackStyles,
      }),
    ).toBe('map-props');
  });

  test('uses the theme-aware host default before the package fallback', () => {
    const protomapsDarkMatter = {
      version: 8 as const,
      sources: {},
      layers: [],
    };
    expect(
      resolveDeckMapStyle({
        hostDefaultStyles: {
          light: 'protomaps-white',
          dark: protomapsDarkMatter,
        },
        resolvedTheme: 'dark',
        fallbackStyles,
      }),
    ).toBe(protomapsDarkMatter);
  });

  test('retains the package fallback for hosts without a provider', () => {
    expect(
      resolveDeckMapStyle({
        resolvedTheme: 'light',
        fallbackStyles,
      }),
    ).toBe('fallback-light');
  });

  test('skips mapbox:// config styles so the host basemap can load', () => {
    expect(isMapboxStyleUrl('mapbox://styles/mapbox/dark-v11')).toBe(true);
    expect(
      resolveDeckMapStyle({
        mapStyle: 'mapbox://styles/mapbox/dark-v11',
        hostDefaultStyles: {dark: 'host-dark'},
        resolvedTheme: 'dark',
        fallbackStyles,
      }),
    ).toBe('host-dark');
  });

  test('skips mapbox:// map props and falls through to host defaults', () => {
    expect(
      resolveDeckMapStyle({
        mapPropsMapStyle: 'mapbox://styles/mapbox/streets-v12',
        hostDefaultStyles: {light: 'host-light'},
        resolvedTheme: 'light',
        fallbackStyles,
      }),
    ).toBe('host-light');
  });

  test('skips mapbox:// host defaults and falls through to package fallback', () => {
    expect(
      resolveDeckMapStyle({
        hostDefaultStyles: {dark: 'mapbox://styles/mapbox/dark-v11'},
        resolvedTheme: 'dark',
        fallbackStyles,
      }),
    ).toBe('fallback-dark');
  });
});
