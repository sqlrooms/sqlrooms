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

function getRawCssVarFromStylesheets(
  selector: string,
  variableName: string,
): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const sheets = Array.from(document.styleSheets ?? []);

  for (const sheet of sheets) {
    let rules: CSSRuleList | undefined;
    try {
      rules = (sheet as CSSStyleSheet).cssRules;
    } catch {
      // Cross-origin stylesheet, ignore
      continue;
    }
    if (!rules) continue;

    for (const rule of Array.from(rules)) {
      // Only CSSStyleRule has selectorText/style
      const styleRule = rule as CSSStyleRule;
      if (!styleRule.selectorText || !styleRule.style) continue;

      if (
        styleRule.selectorText
          .split(',')
          .map((s) => s.trim())
          .includes(selector)
      ) {
        const raw = styleRule.style.getPropertyValue(variableName);
        if (raw) return raw.trim();
      }
    }
  }

  return undefined;
}

/**
 * Reads a CSS variable for a specific theme mode without mutating `<html>` classes.
 * Works with the project's theme CSS that defines light vars under `:root` and
 * dark overrides under `.dark`.
 */
export function getCssColorFromThemeMode(
  themeMode: 'light' | 'dark',
  variableName: string,
  fallbackColor: string,
): string {
  if (typeof document === 'undefined') return fallbackColor;
  try {
    const selector = themeMode === 'dark' ? '.dark' : ':root';
    const raw = getRawCssVarFromStylesheets(selector, variableName);
    if (raw) return normalizeCssColorValue(raw, fallbackColor);
  } catch {
    // ignore; fall back below
  }

  // Fallback: best-effort from current DOM state
  return getCssColor(variableName, fallbackColor);
}

/**
 * Safely gets a CSS variable and ensures it's in a format Monaco can use
 * @param variableName CSS variable name (e.g. '--background')
 * @param fallbackColor Fallback color if the variable isn't found
 * @returns A color string in a format Monaco can use (typically hex)
 */
export function getCssColor(
  variableName: string,
  fallbackColor: string,
): string {
  if (typeof document === 'undefined') return fallbackColor;
  return getCssColorFromElement(
    document.documentElement,
    variableName,
    fallbackColor,
  );
}

/**
 * Safely gets a CSS variable from a specific element and ensures it's in a format Monaco can use.
 * Useful when you need to read theme-scoped variables without mutating `<html>` classes.
 */
export function getCssColorFromElement(
  element: Element,
  variableName: string,
  fallbackColor: string,
): string {
  try {
    // Get CSS variable value
    const cssValue = getComputedStyle(element)
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
    //'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  );
}

/**
 * Gets Monaco editor menu theme colors based on Tailwind CSS variables
 * @param isDarkTheme Whether the current theme is dark or light
 * @returns Object with menu-related color settings for Monaco editor
 */
export function getMenuColors(
  isDarkTheme: boolean,
  elementOrMode?: Element | 'light' | 'dark',
): Record<string, string> {
  const resolvedElementOrMode =
    elementOrMode ??
    (typeof document === 'undefined'
      ? isDarkTheme
        ? 'dark'
        : 'light'
      : document.documentElement);
  const defaultDarkColors = {
    'editorWidget.background': '#1f1f1f',
    'editorWidget.foreground': '#cccccc',
    'editorWidget.border': '#454545',
    'editorSuggestWidget.background': '#252526',
    'list.hoverBackground': '#2a2d2e',
    'list.highlightForeground': '#0097fb',
    'menu.background': '#252526',
    'menu.foreground': '#cccccc',
    'menu.selectionBackground': '#04395e',
    'menu.selectionForeground': '#ffffff',
    'quickInput.background': '#252526',
    'quickInput.foreground': '#cccccc',
    'dropdown.background': '#252526',
    'dropdown.foreground': '#f0f0f0',
  };

  const defaultLightColors = {
    'editorWidget.background': '#f3f3f3',
    'editorWidget.foreground': '#616161',
    'editorWidget.border': '#c8c8c8',
    'editorSuggestWidget.background': '#f3f3f3',
    'list.hoverBackground': '#e8e8e8',
    'list.highlightForeground': '#0066bf',
    'menu.background': '#f3f3f3',
    'menu.foreground': '#616161',
    'menu.selectionBackground': '#d6ebff',
    'menu.selectionForeground': '#333333',
    'quickInput.background': '#f3f3f3',
    'quickInput.foreground': '#616161',
    'dropdown.background': '#f3f3f3',
    'dropdown.foreground': '#616161',
  };

  // Choose base defaults based on theme
  const defaults = isDarkTheme ? defaultDarkColors : defaultLightColors;
  const result: Record<string, string> = {};

  const get = (varName: string, fallback: string) => {
    if (typeof resolvedElementOrMode === 'string') {
      return getCssColorFromThemeMode(resolvedElementOrMode, varName, fallback);
    }
    return getCssColorFromElement(resolvedElementOrMode, varName, fallback);
  };

  // Map Tailwind variables to Monaco color settings
  if (isDarkTheme) {
    // Dark theme mappings
    result['editorWidget.background'] = get(
      '--popover',
      defaults['editorWidget.background'],
    );
    result['editorWidget.foreground'] = get(
      '--popover-foreground',
      defaults['editorWidget.foreground'],
    );
    result['editorWidget.border'] = get(
      '--border',
      defaults['editorWidget.border'],
    );
    result['editorSuggestWidget.background'] = get(
      '--popover',
      defaults['editorSuggestWidget.background'],
    );
    result['list.hoverBackground'] = get(
      '--accent',
      defaults['list.hoverBackground'],
    );
    result['list.highlightForeground'] = get(
      '--primary',
      defaults['list.highlightForeground'],
    );
    result['menu.background'] = get('--popover', defaults['menu.background']);
    result['menu.foreground'] = get(
      '--popover-foreground',
      defaults['menu.foreground'],
    );
    result['menu.selectionBackground'] = get(
      '--accent',
      defaults['menu.selectionBackground'],
    );
    result['menu.selectionForeground'] = get(
      '--accent-foreground',
      defaults['menu.selectionForeground'],
    );
    result['quickInput.background'] = get(
      '--popover',
      defaults['quickInput.background'],
    );
    result['quickInput.foreground'] = get(
      '--popover-foreground',
      defaults['quickInput.foreground'],
    );
    result['dropdown.background'] = get(
      '--popover',
      defaults['dropdown.background'],
    );
    result['dropdown.foreground'] = get(
      '--popover-foreground',
      defaults['dropdown.foreground'],
    );
  } else {
    // Light theme mappings
    result['editorWidget.background'] = get(
      '--popover',
      defaults['editorWidget.background'],
    );
    result['editorWidget.foreground'] = get(
      '--popover-foreground',
      defaults['editorWidget.foreground'],
    );
    result['editorWidget.border'] = get(
      '--border',
      defaults['editorWidget.border'],
    );
    result['editorSuggestWidget.background'] = get(
      '--popover',
      defaults['editorSuggestWidget.background'],
    );
    result['list.hoverBackground'] = get(
      '--accent',
      defaults['list.hoverBackground'],
    );
    result['list.highlightForeground'] = get(
      '--primary',
      defaults['list.highlightForeground'],
    );
    result['menu.background'] = get('--popover', defaults['menu.background']);
    result['menu.foreground'] = get(
      '--popover-foreground',
      defaults['menu.foreground'],
    );
    result['menu.selectionBackground'] = get(
      '--accent',
      defaults['menu.selectionBackground'],
    );
    result['menu.selectionForeground'] = get(
      '--accent-foreground',
      defaults['menu.selectionForeground'],
    );
    result['quickInput.background'] = get(
      '--popover',
      defaults['quickInput.background'],
    );
    result['quickInput.foreground'] = get(
      '--popover-foreground',
      defaults['quickInput.foreground'],
    );
    result['dropdown.background'] = get(
      '--popover',
      defaults['dropdown.background'],
    );
    result['dropdown.foreground'] = get(
      '--popover-foreground',
      defaults['dropdown.foreground'],
    );
  }

  return result;
}

/**
 * Generates a Monaco editor theme specifically for JSON editing with Tailwind colors
 * @param isDarkTheme Whether the current theme is dark or light
 * @returns A complete Monaco editor theme data object for JSON editing
 */
export function getJsonEditorTheme(
  isDarkTheme: boolean,
  elementOrMode?: Element | 'light' | 'dark',
): any {
  const resolvedElementOrMode =
    elementOrMode ??
    (typeof document === 'undefined'
      ? isDarkTheme
        ? 'dark'
        : 'light'
      : document.documentElement);
  // Predefined pastel colors for syntax highlighting
  // Light theme colors
  const lightThemeColors = {
    property: '#4B6BDF', // Soft blue for property names
    string: '#DB745C', // Soft coral for string values
    number: '#56A64B', // Soft green for numbers
    keyword: '#A450B5', // Soft purple for keywords
    punctuation: '#6E7781', // Soft gray for punctuation
  };

  // Dark theme colors
  const darkThemeColors = {
    property: '#78AEFF', // Pastel blue for property names
    string: '#FFAD85', // Pastel coral/orange for string values
    number: '#7CD992', // Pastel green for numbers
    keyword: '#C987E8', // Pastel purple for keywords
    punctuation: '#A9B1BA', // Light gray for punctuation
  };

  // Select the appropriate color set based on theme
  const colors = isDarkTheme ? darkThemeColors : lightThemeColors;

  // Theme background and UI colors - still using CSS variables for the editor itself
  const get = (varName: string, fallback: string) => {
    if (typeof resolvedElementOrMode === 'string') {
      return getCssColorFromThemeMode(resolvedElementOrMode, varName, fallback);
    }
    return getCssColorFromElement(resolvedElementOrMode, varName, fallback);
  };

  const background = get('--background', isDarkTheme ? '#1E1E1E' : '#FFFFFF');
  const foreground = get('--foreground', isDarkTheme ? '#D4D4D4' : '#000000');
  const selection = get('--accent', isDarkTheme ? '#264F78' : '#ADD6FF');
  const lineHighlight = get('--muted', isDarkTheme ? '#2A2A2A' : '#F5F5F5');
  const lineNumbers = get(
    '--muted-foreground',
    isDarkTheme ? '#858585' : '#888888',
  );
  const cursor = get('--primary', isDarkTheme ? '#FFFFFF' : '#000000');

  // Menu colors
  const menuBackground = get('--popover', isDarkTheme ? '#1C2233' : '#F3F3F3');
  const menuForeground = get(
    '--popover-foreground',
    isDarkTheme ? '#FFFFFF' : '#616161',
  );
  const menuSeparator = get('--border', isDarkTheme ? '#39435E' : '#C8C8C8');

  return {
    base: isDarkTheme ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      // Property keys - using pastel blue
      {token: 'type', foreground: colors.property.slice(1)},
      {token: 'string.key.json', foreground: colors.property.slice(1)},
      {token: 'key', foreground: colors.property.slice(1)},

      // String values - using pastel coral/orange
      {token: 'string.value.json', foreground: colors.string.slice(1)},
      {token: 'string', foreground: colors.string.slice(1)},

      // Numbers - using pastel green
      {token: 'number', foreground: colors.number.slice(1)},

      // Keywords (true, false, null) - using pastel purple
      {token: 'keyword', foreground: colors.keyword.slice(1)},

      // Punctuation - using light gray
      {token: 'delimiter', foreground: colors.punctuation.slice(1)},
      {token: 'bracket', foreground: colors.punctuation.slice(1)},

      // Fallbacks
      {token: '', foreground: foreground.slice(1)},
    ],
    colors: {
      // Editor colors
      'editor.background': background,
      'editor.foreground': foreground,
      'editor.selectionBackground': selection,
      'editor.lineHighlightBackground': lineHighlight,
      'editorLineNumber.foreground': lineNumbers,
      'editorCursor.foreground': cursor,

      // Widget and UI colors
      'editorWidget.background': menuBackground,
      'editorWidget.foreground': menuForeground,
      'editorWidget.border': menuSeparator,
      'editorSuggestWidget.background': menuBackground,
      'editorSuggestWidget.foreground': menuForeground,
      'editorSuggestWidget.border': menuSeparator,

      // Menu colors
      'menu.background': menuBackground,
      'menu.foreground': menuForeground,
      'menu.selectionBackground': selection,
      'menu.selectionForeground': menuForeground,
      'menu.separatorBackground': menuSeparator,

      // Additional UI elements
      'list.hoverBackground': lineHighlight,
      'list.activeSelectionBackground': selection,
      'quickInput.background': menuBackground,
      'quickInput.foreground': menuForeground,
    },
  };
}
