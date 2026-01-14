import {resolveFontSizeClass} from '../src/fontSize';

describe('resolveFontSizeClass', () => {
  describe('bare tokens', () => {
    test('resolves "xs" to "text-xs"', () => {
      expect(resolveFontSizeClass('xs')).toBe('text-xs');
    });

    test('resolves "sm" to "text-sm"', () => {
      expect(resolveFontSizeClass('sm')).toBe('text-sm');
    });

    test('resolves "md" to "text-base"', () => {
      expect(resolveFontSizeClass('md')).toBe('text-base');
    });

    test('resolves "lg" to "text-lg"', () => {
      expect(resolveFontSizeClass('lg')).toBe('text-lg');
    });

    test('resolves "xl" to "text-xl"', () => {
      expect(resolveFontSizeClass('xl')).toBe('text-xl');
    });

    test('resolves "base" to "text-base"', () => {
      expect(resolveFontSizeClass('base')).toBe('text-base');
    });
  });

  describe('pass-through for text-* classes', () => {
    test('passes through "text-xs"', () => {
      expect(resolveFontSizeClass('text-xs')).toBe('text-xs');
    });

    test('passes through "text-sm"', () => {
      expect(resolveFontSizeClass('text-sm')).toBe('text-sm');
    });

    test('passes through "text-base"', () => {
      expect(resolveFontSizeClass('text-base')).toBe('text-base');
    });

    test('passes through "text-lg"', () => {
      expect(resolveFontSizeClass('text-lg')).toBe('text-lg');
    });

    test('passes through "text-xl"', () => {
      expect(resolveFontSizeClass('text-xl')).toBe('text-xl');
    });

    test('passes through "text-2xl"', () => {
      expect(resolveFontSizeClass('text-2xl')).toBe('text-2xl');
    });

    test('passes through "text-4xl"', () => {
      expect(resolveFontSizeClass('text-4xl')).toBe('text-4xl');
    });

    test('passes through arbitrary text-* classes', () => {
      expect(resolveFontSizeClass('text-[14px]')).toBe('text-[14px]');
    });
  });

  describe('fallback behavior', () => {
    test('returns "text-xs" for undefined', () => {
      expect(resolveFontSizeClass(undefined)).toBe('text-xs');
    });

    test('returns "text-xs" for empty string', () => {
      expect(resolveFontSizeClass('')).toBe('text-xs');
    });

    test('returns "text-xs" for unknown token', () => {
      expect(resolveFontSizeClass('unknown')).toBe('text-xs');
    });

    test('returns "text-xs" for invalid token', () => {
      expect(resolveFontSizeClass('foo')).toBe('text-xs');
    });
  });
});
