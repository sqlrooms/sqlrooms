// Re-export generic color utilities from shared utils package
import {getCssColor} from '@sqlrooms/utils';

/**
 * Gets Monaco editor menu theme colors based on Tailwind CSS variables
 * @param isDarkTheme Whether the current theme is dark or light
 * @returns Object with menu-related color settings for Monaco editor
 */
export function getMenuColors(isDarkTheme: boolean): Record<string, string> {
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

  // Map Tailwind variables to Monaco color settings
  if (isDarkTheme) {
    // Dark theme mappings
    result['editorWidget.background'] = getCssColor(
      '--popover',
      defaults['editorWidget.background'],
    );
    result['editorWidget.foreground'] = getCssColor(
      '--popover-foreground',
      defaults['editorWidget.foreground'],
    );
    result['editorWidget.border'] = getCssColor(
      '--border',
      defaults['editorWidget.border'],
    );
    result['editorSuggestWidget.background'] = getCssColor(
      '--popover',
      defaults['editorSuggestWidget.background'],
    );
    result['list.hoverBackground'] = getCssColor(
      '--accent',
      defaults['list.hoverBackground'],
    );
    result['list.highlightForeground'] = getCssColor(
      '--primary',
      defaults['list.highlightForeground'],
    );
    result['menu.background'] = getCssColor(
      '--popover',
      defaults['menu.background'],
    );
    result['menu.foreground'] = getCssColor(
      '--popover-foreground',
      defaults['menu.foreground'],
    );
    result['menu.selectionBackground'] = getCssColor(
      '--accent',
      defaults['menu.selectionBackground'],
    );
    result['menu.selectionForeground'] = getCssColor(
      '--accent-foreground',
      defaults['menu.selectionForeground'],
    );
    result['quickInput.background'] = getCssColor(
      '--popover',
      defaults['quickInput.background'],
    );
    result['quickInput.foreground'] = getCssColor(
      '--popover-foreground',
      defaults['quickInput.foreground'],
    );
    result['dropdown.background'] = getCssColor(
      '--popover',
      defaults['dropdown.background'],
    );
    result['dropdown.foreground'] = getCssColor(
      '--popover-foreground',
      defaults['dropdown.foreground'],
    );
  } else {
    // Light theme mappings
    result['editorWidget.background'] = getCssColor(
      '--popover',
      defaults['editorWidget.background'],
    );
    result['editorWidget.foreground'] = getCssColor(
      '--popover-foreground',
      defaults['editorWidget.foreground'],
    );
    result['editorWidget.border'] = getCssColor(
      '--border',
      defaults['editorWidget.border'],
    );
    result['editorSuggestWidget.background'] = getCssColor(
      '--popover',
      defaults['editorSuggestWidget.background'],
    );
    result['list.hoverBackground'] = getCssColor(
      '--accent',
      defaults['list.hoverBackground'],
    );
    result['list.highlightForeground'] = getCssColor(
      '--primary',
      defaults['list.highlightForeground'],
    );
    result['menu.background'] = getCssColor(
      '--popover',
      defaults['menu.background'],
    );
    result['menu.foreground'] = getCssColor(
      '--popover-foreground',
      defaults['menu.foreground'],
    );
    result['menu.selectionBackground'] = getCssColor(
      '--accent',
      defaults['menu.selectionBackground'],
    );
    result['menu.selectionForeground'] = getCssColor(
      '--accent-foreground',
      defaults['menu.selectionForeground'],
    );
    result['quickInput.background'] = getCssColor(
      '--popover',
      defaults['quickInput.background'],
    );
    result['quickInput.foreground'] = getCssColor(
      '--popover-foreground',
      defaults['quickInput.foreground'],
    );
    result['dropdown.background'] = getCssColor(
      '--popover',
      defaults['dropdown.background'],
    );
    result['dropdown.foreground'] = getCssColor(
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
export function getJsonEditorTheme(isDarkTheme: boolean): any {
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

  // Theme background and UI colors - read from current DOM
  const background = getCssColor(
    '--background',
    isDarkTheme ? '#1E1E1E' : '#FFFFFF',
  );
  const foreground = getCssColor(
    '--foreground',
    isDarkTheme ? '#D4D4D4' : '#000000',
  );
  const selection = getCssColor(
    '--accent',
    isDarkTheme ? '#264F78' : '#ADD6FF',
  );
  const lineHighlight = getCssColor(
    '--muted',
    isDarkTheme ? '#2A2A2A' : '#F5F5F5',
  );
  const lineNumbers = getCssColor(
    '--muted-foreground',
    isDarkTheme ? '#858585' : '#888888',
  );
  const cursor = getCssColor('--primary', isDarkTheme ? '#FFFFFF' : '#000000');

  // Menu colors
  const menuBackground = getCssColor(
    '--popover',
    isDarkTheme ? '#1C2233' : '#F3F3F3',
  );
  const menuForeground = getCssColor(
    '--popover-foreground',
    isDarkTheme ? '#FFFFFF' : '#616161',
  );
  const menuSeparator = getCssColor(
    '--border',
    isDarkTheme ? '#39435E' : '#C8C8C8',
  );

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
