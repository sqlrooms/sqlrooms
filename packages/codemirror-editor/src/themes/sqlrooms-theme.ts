import {Extension} from '@codemirror/state';
import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {tags as t} from '@lezer/highlight';
import {createBaseTheme} from './base-theme';

/**
 * Creates a SQLRooms-themed CodeMirror editor with colors from CSS variables
 * @param isDark Whether to use dark theme colors
 * @returns CodeMirror extension for theme
 */
export function createSqlroomsTheme(isDark: boolean): Extension {
  // Use shared base theme
  const baseTheme = createBaseTheme(isDark);

  // Syntax highlighting theme
  const highlightStyle = HighlightStyle.define([
    {tag: t.keyword, color: isDark ? '#569cd6' : '#0000ff'},
    {
      tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
      color: isDark ? '#9cdcfe' : '#001080',
    },
    {
      tag: [t.function(t.variableName), t.labelName],
      color: isDark ? '#dcdcaa' : '#795e26',
    },
    {
      tag: [t.color, t.constant(t.name), t.standard(t.name)],
      color: isDark ? '#4fc1ff' : '#0070c1',
    },
    {
      tag: [t.definition(t.name), t.separator],
      color: isDark ? '#d4d4d4' : '#000000',
    },
    {
      tag: [
        t.typeName,
        t.className,
        t.number,
        t.changed,
        t.annotation,
        t.modifier,
        t.self,
        t.namespace,
      ],
      color: isDark ? '#4ec9b0' : '#098658',
    },
    {
      tag: [
        t.operator,
        t.operatorKeyword,
        t.url,
        t.escape,
        t.regexp,
        t.link,
        t.special(t.string),
      ],
      color: isDark ? '#d4d4d4' : '#000000',
    },
    {tag: [t.meta, t.comment], color: isDark ? '#6a9955' : '#008000'},
    {tag: t.strong, fontWeight: 'bold'},
    {tag: t.emphasis, fontStyle: 'italic'},
    {tag: t.strikethrough, textDecoration: 'line-through'},
    {
      tag: t.link,
      color: isDark ? '#3794ff' : '#0000ee',
      textDecoration: 'underline',
    },
    {tag: t.heading, fontWeight: 'bold', color: isDark ? '#569cd6' : '#0000ff'},
    {
      tag: [t.atom, t.bool, t.special(t.variableName)],
      color: isDark ? '#569cd6' : '#0000ff',
    },
    {
      tag: [t.processingInstruction, t.string, t.inserted],
      color: isDark ? '#ce9178' : '#a31515',
    },
    {tag: t.invalid, color: isDark ? '#f44747' : '#cd3131'},
  ]);

  return [baseTheme, syntaxHighlighting(highlightStyle)];
}
