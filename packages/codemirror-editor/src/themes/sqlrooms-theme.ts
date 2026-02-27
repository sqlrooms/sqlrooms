import {EditorView} from '@codemirror/view';
import {Extension} from '@codemirror/state';
import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {tags as t} from '@lezer/highlight';
import {getMonospaceFont} from '@sqlrooms/utils';

/**
 * Creates a SQLRooms-themed CodeMirror editor with colors from CSS variables
 * @param isDark Whether to use dark theme colors
 * @returns CodeMirror extension for theme
 */
export function createSqlroomsTheme(isDark: boolean): Extension {
  // Get monospace font
  const fontFamily = getMonospaceFont();

  // Base theme with editor styling
  const baseTheme = EditorView.theme(
    {
      '&': {
        backgroundColor: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        height: '100%',
      },
      '.cm-content': {
        caretColor: 'hsl(var(--primary))',
        fontFamily,
        fontSize: '14px',
        lineHeight: '21px',
        paddingTop: '0',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'hsl(var(--primary))',
      },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        {
          backgroundColor: 'hsl(var(--accent))',
        },
      '.cm-activeLine': {
        backgroundColor: 'hsl(var(--muted))',
      },
      '.cm-selectionMatch': {
        backgroundColor: isDark ? '#264f7844' : '#add6ff44',
      },
      '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
        backgroundColor: isDark ? '#ffffff1a' : '#00000011',
        outline: '1px solid hsl(var(--border))',
      },
      '.cm-gutters': {
        backgroundColor: 'hsl(var(--background))',
        color: 'hsl(var(--muted-foreground))',
        border: 'none',
        paddingLeft: '20px',
      },
      '.cm-gutterElement': {
        marginTop: '0',
        paddingRight: '0',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'hsl(var(--muted))',
      },
      '.cm-foldPlaceholder': {
        backgroundColor: isDark ? '#3e3e42' : '#e5e7eb',
        border: '1px solid hsl(var(--border))',
        color: 'hsl(var(--foreground))',
      },
      '.cm-tooltip': {
        backgroundColor: 'hsl(var(--popover))',
        color: 'hsl(var(--popover-foreground))',
        border: '1px solid hsl(var(--border))',
      },
      '.cm-tooltip-autocomplete': {
        '& > ul > li[aria-selected]': {
          backgroundColor: 'hsl(var(--accent))',
          color: 'hsl(var(--foreground))',
        },
      },
      '.cm-completionLabel': {
        color: 'hsl(var(--foreground))',
      },
      '.cm-completionDetail': {
        color: 'hsl(var(--muted-foreground))',
        fontStyle: 'italic',
      },
      '.cm-panels': {
        backgroundColor: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
      },
      '.cm-panels.cm-panels-top': {
        borderBottom: '1px solid hsl(var(--border))',
      },
      '.cm-panels.cm-panels-bottom': {
        borderTop: '1px solid hsl(var(--border))',
      },
      '.cm-searchMatch': {
        backgroundColor: isDark ? '#51504433' : '#ffff0033',
        outline: '1px solid hsl(var(--border))',
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: isDark ? '#515044' : '#ffff00',
      },
      '.cm-button': {
        backgroundImage: 'none',
        backgroundColor: 'hsl(var(--accent))',
        color: 'hsl(var(--foreground))',
        border: '1px solid hsl(var(--border))',
      },
      '.cm-textfield': {
        backgroundColor: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        border: '1px solid hsl(var(--border))',
      },
      // Lint gutter styling
      '.cm-lint-marker': {
        width: '1em',
        height: '1em',
      },
      '.cm-lint-marker-error': {
        content: '✗',
        color: isDark ? '#f48771' : '#d32f2f',
      },
      '.cm-lint-marker-warning': {
        content: '⚠',
        color: isDark ? '#ffab70' : '#f57c00',
      },
      '.cm-diagnostic-error': {
        borderLeft: `3px solid ${isDark ? '#f48771' : '#d32f2f'}`,
      },
      '.cm-diagnostic-warning': {
        borderLeft: `3px solid ${isDark ? '#ffab70' : '#f57c00'}`,
      },
    },
    {dark: isDark},
  );

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
