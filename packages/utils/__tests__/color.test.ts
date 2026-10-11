import {hslToHex} from '../src/color';

// Mock d3-color since it's an ESM module that Jest struggles with
jest.mock('d3-color', () => ({
  color: jest.fn(),
}));

describe('hslToHex', () => {
  describe('basic colors', () => {
    test('converts red (0, 100, 50)', () => {
      expect(hslToHex(0, 100, 50)).toBe('#ff0000');
    });

    test('converts green (120, 100, 50)', () => {
      expect(hslToHex(120, 100, 50)).toBe('#00ff00');
    });

    test('converts blue (240, 100, 50)', () => {
      expect(hslToHex(240, 100, 50)).toBe('#0000ff');
    });

    test('converts yellow (60, 100, 50)', () => {
      expect(hslToHex(60, 100, 50)).toBe('#ffff00');
    });

    test('converts cyan (180, 100, 50)', () => {
      expect(hslToHex(180, 100, 50)).toBe('#00ffff');
    });

    test('converts magenta (300, 100, 50)', () => {
      expect(hslToHex(300, 100, 50)).toBe('#ff00ff');
    });

    test('converts white (0, 0, 100)', () => {
      expect(hslToHex(0, 0, 100)).toBe('#ffffff');
    });

    test('converts black (0, 0, 0)', () => {
      expect(hslToHex(0, 0, 0)).toBe('#000000');
    });

    test('converts gray (0, 0, 50)', () => {
      expect(hslToHex(0, 0, 50)).toBe('#808080');
    });
  });

  describe('hue edge cases', () => {
    test('handles hue = 360 (should wrap to 0 = red)', () => {
      expect(hslToHex(360, 100, 50)).toBe('#ff0000');
    });

    test('handles hue > 360 (390 should wrap to 30 = orange)', () => {
      expect(hslToHex(390, 100, 50)).toBe('#ff8000');
    });

    test('handles negative hue (-30 should wrap to 330 = pink)', () => {
      expect(hslToHex(-30, 100, 50)).toBe('#ff0080');
    });

    test('handles negative hue (-360 should wrap to 0 = red)', () => {
      expect(hslToHex(-360, 100, 50)).toBe('#ff0000');
    });
  });

  describe('saturation edge cases', () => {
    test('handles saturation = 0 (produces gray)', () => {
      expect(hslToHex(120, 0, 50)).toBe('#808080');
    });

    test('handles saturation = 100 (produces pure color)', () => {
      expect(hslToHex(120, 100, 50)).toBe('#00ff00');
    });

    test('clamps saturation > 100 to 100', () => {
      expect(hslToHex(120, 150, 50)).toBe('#00ff00');
    });

    test('clamps negative saturation to 0', () => {
      expect(hslToHex(120, -50, 50)).toBe('#808080');
    });
  });

  describe('lightness edge cases', () => {
    test('handles lightness = 0 (produces black)', () => {
      expect(hslToHex(120, 100, 0)).toBe('#000000');
    });

    test('handles lightness = 100 (produces white)', () => {
      expect(hslToHex(120, 100, 100)).toBe('#ffffff');
    });

    test('clamps lightness > 100 to 100', () => {
      expect(hslToHex(120, 100, 150)).toBe('#ffffff');
    });

    test('clamps negative lightness to 0', () => {
      expect(hslToHex(120, 100, -50)).toBe('#000000');
    });
  });

  describe('real-world color values', () => {
    test('converts HSL (210, 40, 98) to light blue', () => {
      expect(hslToHex(210, 40, 98)).toBe('#f8fafc');
    });

    test('converts HSL (222.2, 84, 4.9) to dark blue', () => {
      expect(hslToHex(222.2, 84, 4.9)).toBe('#020817');
    });

    test('converts HSL (45, 80, 60) to golden yellow', () => {
      expect(hslToHex(45, 80, 60)).toBe('#ebc247');
    });

    test('converts HSL (200, 50, 30) to muted blue', () => {
      expect(hslToHex(200, 50, 30)).toBe('#265973');
    });
  });

  describe('intermediate saturation/lightness', () => {
    test('converts HSL (0, 50, 50) to muted red', () => {
      expect(hslToHex(0, 50, 50)).toBe('#bf4040');
    });

    test('converts HSL (120, 25, 75) to light green', () => {
      expect(hslToHex(120, 25, 75)).toBe('#afcfaf');
    });

    test('converts HSL (240, 75, 25) to deep blue', () => {
      expect(hslToHex(240, 75, 25)).toBe('#101070');
    });
  });
});
