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
 * Generates a Monaco editor theme for Markdown editing with Tailwind colors.
 * Provides syntax-aware highlighting for headings, code blocks, links,
 * bold/italic, lists, block quotes, and inline HTML.
 * @param isDarkTheme Whether the current theme is dark or light
 * @returns A complete Monaco editor theme data object for Markdown editing
 */
export function getMarkdownEditorTheme(isDarkTheme: boolean): any {
  const background = getCssColor(
    '--background',
    isDarkTheme ? '#0b1220' : '#ffffff',
  );
  const foreground = getCssColor(
    '--foreground',
    isDarkTheme ? '#e0e6ed' : '#24292f',
  );
  const lineHighlight = getCssColor(
    '--muted',
    isDarkTheme ? '#111a2b' : '#f5f5f5',
  );
  const cursor = getCssColor('--primary', isDarkTheme ? '#ffffff' : '#000000');
  const selection = getCssColor(
    '--accent',
    isDarkTheme ? '#23436b' : '#e3e3e3',
  );
  const lineNumbers = getCssColor(
    '--muted-foreground',
    isDarkTheme ? '#8b97ab' : '#888888',
  );

  const heading = getCssColor(
    '--editor-heading',
    isDarkTheme ? '#78AEFF' : '#0550AE',
  );
  const bold = isDarkTheme ? '#E0E6ED' : '#24292F';
  const italic = isDarkTheme ? '#C987E8' : '#8250DF';
  const link = getCssColor(
    '--editor-link',
    isDarkTheme ? '#58A6FF' : '#0969DA',
  );
  const codeInline = isDarkTheme ? '#FFAD85' : '#DB745C';
  const codeContent = isDarkTheme ? '#8BD5CA' : '#2B6F63';
  const codeFence = isDarkTheme ? '#525C6A' : '#A0A8B4';
  const listMarker = isDarkTheme ? '#F0883E' : '#CF5309';
  const quote = isDarkTheme ? '#8b97ab' : '#6E7781';
  const separator = isDarkTheme ? '#3D444D' : '#D0D7DE';
  const htmlTag = isDarkTheme ? '#7CD992' : '#116329';

  const fg = (hex: string) => hex.slice(1);

  return {
    base: isDarkTheme ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      // Headings (# to ######)
      {token: 'keyword.md', foreground: fg(heading), fontStyle: 'bold'},
      {token: 'keyword.table.header.md', foreground: fg(heading)},

      // Bold **text**
      {token: 'strong.md', foreground: fg(bold), fontStyle: 'bold'},

      // Italic *text*
      {token: 'emphasis.md', foreground: fg(italic), fontStyle: 'italic'},

      // Strikethrough ~~text~~
      {token: 'strikethrough.md', fontStyle: 'strikethrough'},

      // Links [text](url)
      {token: 'string.link.md', foreground: fg(link)},
      {token: 'type.header.md', foreground: fg(link), fontStyle: 'underline'},

      // Inline code `code`
      {token: 'variable.md', foreground: fg(codeInline)},

      // Fenced code block fence markers (``` lines)
      {token: 'variable.source.md', foreground: fg(codeFence)},

      // Fenced code block content
      {token: 'string.md', foreground: fg(codeContent)},

      // List markers (-, *, 1.)
      {token: 'keyword.list.md', foreground: fg(listMarker)},

      // Block quotes >
      {token: 'comment.md', foreground: fg(quote), fontStyle: 'italic'},
      {token: 'quote.md', foreground: fg(quote), fontStyle: 'italic'},

      // Horizontal rules --- / ***
      {token: 'keyword.hr.md', foreground: fg(separator)},

      // HTML tags in markdown
      {token: 'tag.md', foreground: fg(htmlTag)},
      {token: 'tag', foreground: fg(htmlTag)},
      {token: 'attribute.name.md', foreground: fg(heading)},
      {token: 'attribute.value.md', foreground: fg(codeInline)},

      // Fallback
      {token: '', foreground: fg(foreground)},
    ],
    colors: {
      'editor.background': background,
      'editor.foreground': foreground,
      'editor.lineHighlightBackground': lineHighlight,
      'editorCursor.foreground': cursor,
      'editor.selectionBackground': selection,
      'editorLineNumber.foreground': lineNumbers,
      ...getMenuColors(isDarkTheme),
    },
  };
}

/**
 * Generates a Monaco editor theme specifically for JSON editing with Tailwind colors
 * @param isDarkTheme Whether the current theme is dark or light
 * @returns A complete Monaco editor theme data object for JSON editing
 */
export function getJsonEditorTheme(isDarkTheme: boolean): any {
  // Get syntax colors from CSS variables with fallbacks
  const property = getCssColor(
    '--editor-property',
    isDarkTheme ? '#78AEFF' : '#4B6BDF',
  );
  const string = getCssColor(
    '--editor-string',
    isDarkTheme ? '#FFAD85' : '#DB745C',
  );
  const number = getCssColor(
    '--editor-number',
    isDarkTheme ? '#7CD992' : '#56A64B',
  );
  const keyword = getCssColor(
    '--editor-keyword',
    isDarkTheme ? '#C987E8' : '#A450B5',
  );
  const punctuation = getCssColor(
    '--editor-punctuation',
    isDarkTheme ? '#A9B1BA' : '#6E7781',
  );
  const comment = getCssColor(
    '--editor-comment',
    isDarkTheme ? '#6A9955' : '#008000',
  );
  const invalid = getCssColor(
    '--editor-invalid',
    isDarkTheme ? '#F44747' : '#CD3131',
  );

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
      // Property keys
      {token: 'type', foreground: property.slice(1)},
      {token: 'string.key.json', foreground: property.slice(1)},
      {token: 'key', foreground: property.slice(1)},

      // String values
      {token: 'string.value.json', foreground: string.slice(1)},
      {token: 'string', foreground: string.slice(1)},

      // Numbers
      {token: 'number', foreground: number.slice(1)},

      // Keywords (true, false, null)
      {token: 'keyword', foreground: keyword.slice(1)},

      // Punctuation
      {token: 'delimiter', foreground: punctuation.slice(1)},
      {token: 'bracket', foreground: punctuation.slice(1)},

      // Comments
      {token: 'comment', foreground: comment.slice(1)},

      // Invalid syntax
      {token: 'invalid', foreground: invalid.slice(1)},

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
