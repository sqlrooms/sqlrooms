import {color as d3color} from 'd3-color';

export function opacifyHex(hexCode: string, opacity: number): string {
  const c = d3color(hexCode);
  if (!c) {
    console.warn('Invalid color: ', hexCode);
    return `rgba(255, 255, 255, ${opacity})`;
  }
  const col = c.rgb();
  return `rgba(${col.r}, ${col.g}, ${col.b}, ${opacity})`;
}

/**
 * Converts HSL color values to Hex color string
 * @param h Hue (0-360)
 * @param s Saturation (0-100)
 * @param l Lightness (0-100)
 * @returns Hex color string (#RRGGBB)
 */
export function hslToHex(h: number, s: number, l: number): string {
  // Convert saturation and lightness to fractions
  s /= 100;
  l /= 100;

  // Calculate chroma
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  // Convert RGB to hex format
  const toHex = (c: number) => {
    const hex = Math.round((c + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function normalizeCssColorValue(
  cssValue: string,
  fallbackColor: string,
): string {
  const trimmed = cssValue.trim();
  if (!trimmed) return fallbackColor;

  // If already a hex color, return it
  if (trimmed.startsWith('#')) return trimmed;

  // Check if value is in HSL format (e.g. "210 40% 98%" or "222.2 84% 4.9%")
  const hslMatch = trimmed.match(
    /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/,
  );
  if (hslMatch && hslMatch[1] && hslMatch[2] && hslMatch[3]) {
    const h = parseFloat(hslMatch[1]);
    const s = parseFloat(hslMatch[2]);
    const l = parseFloat(hslMatch[3]);
    return hslToHex(h, s, l);
  }

  return fallbackColor;
}

/**
 * Safely gets a CSS variable and ensures it's in hex format
 * @param variableName CSS variable name (e.g. '--background')
 * @param fallbackColor Fallback color if the variable isn't found
 * @returns A color string in hex format
 */
export function getCssColor(
  variableName: string,
  fallbackColor: string,
): string {
  if (typeof document === 'undefined') return fallbackColor;
  try {
    // Get CSS variable value from current DOM
    const cssValue = getComputedStyle(document.documentElement)
      .getPropertyValue(variableName)
      .trim();

    if (!cssValue) return fallbackColor;
    return normalizeCssColorValue(cssValue, fallbackColor);
  } catch (error) {
    console.error(`Error getting CSS variable ${variableName}:`, error);
    return fallbackColor;
  }
}

/**
 * Gets a monospace font family from CSS variables or falls back to a system monospace font stack
 * @returns Monospace font family string suitable for code editors
 */
export function getMonospaceFont(): string {
  if (typeof document === 'undefined') {
    return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  }
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue('--font-mono')
      .trim() ||
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  );
}
