import {Extension} from '@codemirror/state';
import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {tags as t} from '@lezer/highlight';
import {createBaseTheme, BaseThemeOptions} from './base-theme';

export function createJsonTheme(options: BaseThemeOptions = {}): Extension {
  // Use shared base theme
  const baseTheme = createBaseTheme(options);

  // JSON-specific syntax highlighting using CSS variables
  const highlightStyle = HighlightStyle.define([
    // Property keys
    {tag: [t.propertyName], color: 'hsl(var(--editor-property))'},
    // String values
    {tag: [t.string], color: 'hsl(var(--editor-string))'},
    // Numbers
    {tag: [t.number], color: 'hsl(var(--editor-number))'},
    // Keywords (true, false, null)
    {tag: [t.bool, t.null, t.keyword], color: 'hsl(var(--editor-keyword))'},
    // Punctuation (brackets, braces, commas, colons)
    {
      tag: [t.bracket, t.punctuation, t.separator],
      color: 'hsl(var(--editor-punctuation))',
    },
    // Comments (if present in JSONC)
    {tag: [t.comment], color: 'hsl(var(--editor-comment))'},
    // Invalid syntax
    {tag: t.invalid, color: 'hsl(var(--editor-invalid))'},
  ]);

  return [baseTheme, syntaxHighlighting(highlightStyle)];
}
