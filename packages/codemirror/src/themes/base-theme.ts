import {EditorView} from '@codemirror/view';
import {Extension} from '@codemirror/state';
import {getMonospaceFont} from '@sqlrooms/utils';

export interface BaseThemeOptions {
  isDark?: boolean;
  hideGutter?: boolean;
}

export function createBaseTheme({
  isDark,
  hideGutter,
}: BaseThemeOptions = {}): Extension {
  // Get monospace font
  const fontFamily = getMonospaceFont();

  // Base theme with editor styling
  return EditorView.theme(
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
        backgroundColor: 'hsl(var(--editor-selection-match) / 0.27)',
      },
      '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
        backgroundColor: 'hsl(var(--editor-bracket-match) / 0.1)',
        outline: '1px solid hsl(var(--border))',
      },
      '.cm-gutters': {
        backgroundColor: 'hsl(var(--background))',
        color: 'hsl(var(--muted-foreground))',
        border: 'none',
        paddingLeft: '20px',
        ...(hideGutter && {display: 'none'}),
      },
      '.cm-gutterElement': {
        marginTop: '0',
        paddingRight: '0',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'hsl(var(--muted))',
      },
      '.cm-foldPlaceholder': {
        backgroundColor: 'hsl(var(--editor-fold-placeholder))',
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
        backgroundColor: 'hsl(var(--editor-search-match) / 0.2)',
        outline: '1px solid hsl(var(--border))',
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'hsl(var(--editor-search-match-selected))',
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
        color: 'hsl(var(--editor-lint-error))',
      },
      '.cm-lint-marker-warning': {
        content: '⚠',
        color: 'hsl(var(--editor-lint-warning))',
      },
      '.cm-diagnostic-error': {
        borderLeft: '3px solid hsl(var(--editor-lint-error))',
      },
      '.cm-diagnostic-warning': {
        borderLeft: '3px solid hsl(var(--editor-lint-warning))',
      },
    },
    {dark: isDark},
  );
}
