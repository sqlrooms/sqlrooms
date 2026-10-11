import {describe, expect, test} from '@jest/globals';
import {
  createProtomapsBasemapProvider,
  createProtomapsDefaultStyles,
  createProtomapsStyle,
} from '../src/protomapsStyles';
import {resolveDeckMapStyle} from '../src/basemap';

describe('Protomaps basemaps', () => {
  test('caches provider styles and keeps each key in its own provider', () => {
    const provider = createProtomapsBasemapProvider('test-key');
    expect(provider('dark')).toBe(provider('dark'));
    expect(provider('light')).toBe(provider('light'));
    expect(provider('dark')).not.toEqual(provider('light'));
    expect(provider('dark')).not.toEqual(
      createProtomapsBasemapProvider('another-key')('dark'),
    );
  });

  test.each([undefined, '', '   '])(
    'does not generate Protomaps styles when the key is %p',
    (key) => {
      const provider = createProtomapsBasemapProvider(key);
      expect(provider('dark')).toBeUndefined();
      expect(provider('light')).toBeUndefined();
    },
  );

  test('uses the v4 vector tiles API and preserves the supplied key', () => {
    const apiKey = 'test+key&with=special?characters';
    const style = createProtomapsStyle('white', apiKey);
    const source = style.sources.protomaps;
    if (source?.type !== 'vector' || !source.url) {
      throw new Error('Expected a Protomaps vector TileJSON source');
    }

    const url = new URL(source.url);
    expect(url.origin).toBe('https://api.protomaps.com');
    expect(url.pathname).toBe('/tiles/v4.json');
    expect([...url.searchParams]).toEqual([['key', apiKey]]);
    expect(source.attribution).toContain('https://protomaps.com');
    expect(source.attribution).toContain('https://openstreetmap.org');
    expect(style.layers.some((layer) => layer.type === 'symbol')).toBe(true);
    for (const layer of style.layers) {
      if ('source' in layer) expect(layer.source).toBe('protomaps');
    }
  });

  test('provides distinct theme defaults with matching sprites and fonts', () => {
    const styles = createProtomapsDefaultStyles('test-key');
    expect(styles.light).not.toEqual(styles.dark);
    for (const [theme, flavor] of [
      ['light', 'white'],
      ['dark', 'black'],
    ] as const) {
      const style = styles[theme];
      expect(style.sprite).toBe(
        `https://protomaps.github.io/basemaps-assets/sprites/v4/${flavor}`,
      );
      expect(style.glyphs).toBe(
        'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
      );
      expect(
        resolveDeckMapStyle({resolvedTheme: theme, fallbackStyles: styles}),
      ).toBe(style);
    }
  });
});
