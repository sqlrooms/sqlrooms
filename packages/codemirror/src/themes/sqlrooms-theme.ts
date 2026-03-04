import {Extension} from '@codemirror/state';
import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {tags as t} from '@lezer/highlight';
import {createBaseTheme, BaseThemeOptions} from './base-theme';
export function createSqlroomsTheme(options: BaseThemeOptions = {}): Extension {
  const baseTheme = createBaseTheme(options);

  // Syntax highlighting theme using CSS variables
  const highlightStyle = HighlightStyle.define([
    {tag: t.keyword, color: 'hsl(var(--editor-keyword))'},
    {
      tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
      color: 'hsl(var(--editor-property))',
    },
    {
      tag: [t.function(t.variableName), t.labelName],
      color: 'hsl(var(--editor-function))',
    },
    {
      tag: [t.color, t.constant(t.name), t.standard(t.name)],
      color: 'hsl(var(--editor-constant))',
    },
    {
      tag: [t.definition(t.name), t.separator],
      color: 'hsl(var(--editor-operator))',
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
      color: 'hsl(var(--editor-type))',
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
      color: 'hsl(var(--editor-operator))',
    },
    {tag: [t.meta, t.comment], color: 'hsl(var(--editor-comment))'},
    {tag: t.strong, fontWeight: 'bold'},
    {tag: t.emphasis, fontStyle: 'italic'},
    {tag: t.strikethrough, textDecoration: 'line-through'},
    {
      tag: t.link,
      color: 'hsl(var(--editor-constant))',
      textDecoration: 'underline',
    },
    {
      tag: t.heading,
      fontWeight: 'bold',
      color: 'hsl(var(--editor-keyword))',
    },
    {
      tag: [t.atom, t.bool, t.special(t.variableName)],
      color: 'hsl(var(--editor-keyword))',
    },
    {
      tag: [t.processingInstruction, t.string, t.inserted],
      color: 'hsl(var(--editor-string))',
    },
    {tag: t.invalid, color: 'hsl(var(--editor-invalid))'},
  ]);

  return [baseTheme, syntaxHighlighting(highlightStyle)];
}
