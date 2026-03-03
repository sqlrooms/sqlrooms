import {Extension} from '@codemirror/state';
import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {tags as t} from '@lezer/highlight';
import {createBaseTheme, BaseThemeOptions} from './base-theme';

export function createSqlTheme(options: BaseThemeOptions = {}): Extension {
  const baseTheme = createBaseTheme(options);

  const highlightStyle = HighlightStyle.define([
    // SQL keywords (SELECT, FROM, WHERE, JOIN, etc.)
    {
      tag: [t.keyword, t.operatorKeyword, t.modifier],
      color: 'hsl(var(--editor-keyword))',
    },
    // String literals
    {tag: [t.string, t.special(t.string)], color: 'hsl(var(--editor-string))'},
    // Numbers
    {tag: [t.number, t.integer, t.float], color: 'hsl(var(--editor-number))'},
    // Comments
    {
      tag: [t.lineComment, t.blockComment, t.comment],
      color: 'hsl(var(--editor-comment))',
    },
    // Operators (+, -, *, /, =, etc.)
    {
      tag: [t.operator, t.compareOperator],
      color: 'hsl(var(--editor-operator))',
    },
    // Punctuation (commas, semicolons, parentheses)
    {
      tag: [t.punctuation, t.separator, t.bracket],
      color: 'hsl(var(--editor-punctuation))',
    },
    // Table names (use type color)
    {tag: [t.typeName], color: 'hsl(var(--editor-type))'},
    // Column names (use property color)
    {
      tag: [t.variableName, t.propertyName, t.attributeName],
      color: 'hsl(var(--editor-property))',
    },
    // Function names
    {
      tag: [t.function(t.variableName), t.function(t.propertyName)],
      color: 'hsl(var(--editor-function))',
    },
    // Boolean literals (TRUE, FALSE)
    {tag: [t.bool], color: 'hsl(var(--editor-keyword))'},
    // NULL keyword
    {tag: [t.null], color: 'hsl(var(--editor-keyword))'},
    // Invalid syntax
    {tag: [t.invalid], color: 'hsl(var(--editor-invalid))'},
  ]);

  return [baseTheme, syntaxHighlighting(highlightStyle)];
}
