import {Extension} from '@codemirror/state';
import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {tags as t} from '@lezer/highlight';
import {createBaseTheme} from './base-theme';

/**
 * Creates a JSON-specific theme with pastel syntax colors matching Monaco's JSON theme
 * @param isDark Whether to use dark theme colors
 * @returns CodeMirror extension for JSON theme
 */
export function createJsonTheme(isDark: boolean): Extension {
  // Pastel syntax colors for JSON (matching Monaco's JSON theme)
  const jsonColors = isDark
    ? {
        property: '#78AEFF', // Pastel blue for property names
        string: '#FFAD85', // Pastel coral/orange for string values
        number: '#7CD992', // Pastel green for numbers
        keyword: '#C987E8', // Pastel purple for keywords (true/false/null)
        punctuation: '#A9B1BA', // Light gray for punctuation
      }
    : {
        property: '#4B6BDF', // Soft blue for property names
        string: '#DB745C', // Soft coral for string values
        number: '#56A64B', // Soft green for numbers
        keyword: '#A450B5', // Soft purple for keywords
        punctuation: '#6E7781', // Soft gray for punctuation
      };

  // Use shared base theme
  const baseTheme = createBaseTheme(isDark);

  // JSON-specific syntax highlighting with pastel colors
  const highlightStyle = HighlightStyle.define([
    // Property keys - pastel blue
    {tag: [t.propertyName], color: jsonColors.property},
    // String values - pastel coral/orange
    {tag: [t.string], color: jsonColors.string},
    // Numbers - pastel green
    {tag: [t.number], color: jsonColors.number},
    // Keywords (true, false, null) - pastel purple
    {tag: [t.bool, t.null, t.keyword], color: jsonColors.keyword},
    // Punctuation (brackets, braces, commas, colons) - light gray
    {
      tag: [t.bracket, t.punctuation, t.separator],
      color: jsonColors.punctuation,
    },
    // Comments (if present in JSONC)
    {tag: [t.comment], color: isDark ? '#6a9955' : '#008000'},
    // Invalid syntax
    {tag: t.invalid, color: isDark ? '#f44747' : '#cd3131'},
  ]);

  return [baseTheme, syntaxHighlighting(highlightStyle)];
}
