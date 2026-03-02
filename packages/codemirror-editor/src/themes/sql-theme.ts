import {Extension} from '@codemirror/state';
import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {tags as t} from '@lezer/highlight';
import {createBaseTheme} from './base-theme';

/**
 * Creates a SQL-specific theme matching Monaco's SQL color scheme
 * @param isDark Whether to use dark theme colors
 * @returns CodeMirror extension for SQL theme
 */
export function createSqlTheme(isDark: boolean): Extension {
  // SQL syntax colors matching Monaco's SQL theme
  const sqlColors = isDark
    ? {
        keyword: '#569CD6', // Blue for SQL keywords (SELECT, FROM, WHERE, etc.)
        string: '#CE9178', // Peach/orange for string literals
        number: '#B5CEA8', // Light green for numbers
        comment: '#6A9955', // Green for comments
        operator: '#D4D4D4', // Light gray for operators
        punctuation: '#D4D4D4', // Light gray for punctuation
        tableName: 'hsl(var(--foreground))', // Default foreground (white-ish) for table names
        columnName: '#9CDCFE', // Light blue for column names
      }
    : {
        keyword: '#0000FF', // Blue for SQL keywords
        string: '#A31515', // Red for string literals
        number: '#098658', // Green for numbers
        comment: '#008000', // Green for comments
        operator: '#000000', // Black for operators
        punctuation: '#000000', // Black for punctuation
        tableName: 'hsl(var(--foreground))', // Default foreground (black) for table names
        columnName: '#001080', // Dark blue for column names
      };

  // Use shared base theme
  const baseTheme = createBaseTheme(isDark);

  // SQL-specific syntax highlighting matching Monaco
  const highlightStyle = HighlightStyle.define([
    // SQL keywords (SELECT, FROM, WHERE, JOIN, etc.) - blue
    {tag: [t.keyword, t.operatorKeyword, t.modifier], color: sqlColors.keyword},
    // String literals - peach/red
    {tag: [t.string, t.special(t.string)], color: sqlColors.string},
    // Numbers - green
    {tag: [t.number, t.integer, t.float], color: sqlColors.number},
    // Comments - green
    {tag: [t.lineComment, t.blockComment, t.comment], color: sqlColors.comment},
    // Operators (+, -, *, /, =, etc.) - gray/black
    {tag: [t.operator, t.compareOperator], color: sqlColors.operator},
    // Punctuation (commas, semicolons, parentheses) - gray/black
    {tag: [t.punctuation, t.separator, t.bracket], color: sqlColors.punctuation},
    // Table names (should be default foreground - black in light, white in dark)
    // typeName is often used for table names in SQL parsers
    {tag: [t.typeName], color: sqlColors.tableName},
    // Column names - light blue
    // variableName and propertyName are used for identifiers/columns
    {
      tag: [t.variableName, t.propertyName, t.attributeName],
      color: sqlColors.columnName,
    },
    // Function names - yellow (Monaco style)
    {
      tag: [t.function(t.variableName), t.function(t.propertyName)],
      color: isDark ? '#DCDCAA' : '#795E26',
    },
    // Boolean literals (TRUE, FALSE)
    {tag: [t.bool], color: sqlColors.keyword},
    // NULL keyword
    {tag: [t.null], color: sqlColors.keyword},
    // Invalid syntax
    {tag: [t.invalid], color: isDark ? '#f44747' : '#cd3131'},
  ]);

  return [baseTheme, syntaxHighlighting(highlightStyle)];
}
