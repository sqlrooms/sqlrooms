import {describe, expect, jest, test} from '@jest/globals';
import {isMapboxStyleUrl, resolveDeckMapStyle} from '../src/basemap';

const fallbackStyles = {
  light: 'fallback-light',
  dark: 'fallback-dark',
};

describe('resolveDeckMapStyle', () => {
  test('resolves the saved style through the provider before context defaults', () => {
    const basemapProvider = jest.fn((theme: string) => `tiles-${theme}`);
    expect(
      resolveDeckMapStyle({
        mapStyle: 'protomaps-dark',
        basemapProvider,
        hostDefaultStyles: {dark: 'context-dark'},
        resolvedTheme: 'light',
        fallbackStyles,
      }),
    ).toBe('tiles-dark');
    expect(basemapProvider).toHaveBeenCalledWith('dark');
  });

  test('uses the current theme for legacy maps without a saved style', () => {
    const basemapProvider = (theme: string) => `tiles-${theme}`;
    for (const resolvedTheme of ['dark', 'light'] as const) {
      expect(
        resolveDeckMapStyle({basemapProvider, resolvedTheme, fallbackStyles}),
      ).toBe(`tiles-${resolvedTheme}`);
    }
  });

  test('preserves explicit custom styles without invoking the provider', () => {
    const basemapProvider = jest.fn(() => 'provider-style');
    const customStyle = {version: 8 as const, sources: {}, layers: []};
    expect(
      resolveDeckMapStyle({
        mapStyle: 'https://example.com/style.json',
        basemapProvider,
        resolvedTheme: 'dark',
        fallbackStyles,
      }),
    ).toBe('https://example.com/style.json');
    expect(
      resolveDeckMapStyle({
        mapPropsMapStyle: customStyle,
        basemapProvider,
        resolvedTheme: 'dark',
        fallbackStyles,
      }),
    ).toBe(customStyle);
    expect(basemapProvider).not.toHaveBeenCalled();
  });

  test('falls through to context or package defaults for unavailable provider styles', () => {
    for (const result of [undefined, 'mapbox://styles/mapbox/dark-v11']) {
      const options = {
        basemapProvider: () => result,
        resolvedTheme: 'dark' as const,
        fallbackStyles,
      };
      expect(
        resolveDeckMapStyle({
          ...options,
          hostDefaultStyles: {dark: 'context-dark'},
        }),
      ).toBe('context-dark');
      expect(resolveDeckMapStyle(options)).toBe('fallback-dark');
    }
  });

  test('retains a saved basemap when the app theme changes', () => {
    expect(
      resolveDeckMapStyle({
        mapStyle: 'protomaps-dark',
        hostDefaultStyles: {light: 'host-light', dark: 'host-dark'},
        resolvedTheme: 'light',
        fallbackStyles,
      }),
    ).toBe('host-dark');
    expect(
      resolveDeckMapStyle({
        mapStyle: 'protomaps-light',
        resolvedTheme: 'dark',
        fallbackStyles,
      }),
    ).toBe('fallback-light');
  });

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
