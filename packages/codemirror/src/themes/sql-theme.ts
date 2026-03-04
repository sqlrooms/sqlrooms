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
      color: 'var(--color-editor-keyword)',
    },
    // String literals
    {tag: [t.string, t.special(t.string)], color: 'var(--color-editor-string)'},
    // Numbers
    {tag: [t.number, t.integer, t.float], color: 'var(--color-editor-number)'},
    // Comments
    {
      tag: [t.lineComment, t.blockComment, t.comment],
      color: 'var(--color-editor-comment)',
    },
    // Operators (+, -, *, /, =, etc.)
    {
      tag: [t.operator, t.compareOperator],
      color: 'var(--color-editor-operator)',
    },
    // Punctuation (commas, semicolons, parentheses)
    {
      tag: [t.punctuation, t.separator, t.bracket],
      color: 'var(--color-editor-punctuation)',
    },
    // Table names (use type color)
    {tag: [t.typeName], color: 'var(--color-editor-type)'},
    // Column names (use property color)
    {
      tag: [t.variableName, t.propertyName, t.attributeName],
      color: 'var(--color-editor-property)',
    },
    // Function names
    {
      tag: [t.function(t.variableName), t.function(t.propertyName)],
      color: 'var(--color-editor-function)',
    },
    // Boolean literals (TRUE, FALSE)
    {tag: [t.bool], color: 'var(--color-editor-keyword)'},
    // NULL keyword
    {tag: [t.null], color: 'var(--color-editor-keyword)'},
    // Invalid syntax
    {tag: [t.invalid], color: 'var(--color-editor-invalid)'},
  ]);

  return [baseTheme, syntaxHighlighting(highlightStyle)];
}
