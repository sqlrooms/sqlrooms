import {describe, expect, test} from '@jest/globals';
import {resolveDeckMapStyle} from '../src/DeckMapDefaultStylesProvider';

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
});
