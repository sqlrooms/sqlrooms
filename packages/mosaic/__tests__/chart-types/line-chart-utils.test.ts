import {getUnusedColor} from '../../src/charts/chart-types/line-chart/utils';

describe('line-chart utils', () => {
  const MOCK_COLORS = ['#red', '#blue', '#green', '#yellow'];

  describe('getUnusedColor', () => {
    it('returns first color when no colors are used', () => {
      const result = getUnusedColor(MOCK_COLORS, []);
      expect(result).toBe('#red');
    });

    it('skips used colors and returns first unused', () => {
      const result = getUnusedColor(MOCK_COLORS, ['#red']);
      expect(result).toBe('#blue');
    });

    it('returns first unused color when multiple are used', () => {
      const result = getUnusedColor(MOCK_COLORS, ['#red', '#blue', '#yellow']);
      expect(result).toBe('#green');
    });

    it('returns first color when all colors are used', () => {
      const result = getUnusedColor(MOCK_COLORS, [
        '#red',
        '#blue',
        '#green',
        '#yellow',
      ]);
      expect(result).toBe('#red');
    });

    it('handles colors in non-sequential order', () => {
      const result = getUnusedColor(MOCK_COLORS, ['#green', '#red']);
      expect(result).toBe('#blue');
    });
  });
});
