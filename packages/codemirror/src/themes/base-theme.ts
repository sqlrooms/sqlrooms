import {EditorView} from '@codemirror/view';
import {Extension} from '@codemirror/state';
import {getMonospaceFont} from '@sqlrooms/utils';
import {getTheme} from '@sqlrooms/ui';

export interface BaseThemeOptions {
  hideGutter?: boolean;
}

export function createBaseTheme({
  hideGutter,
}: BaseThemeOptions = {}): Extension {
  const theme = getTheme();

  // Get monospace font
  const fontFamily = getMonospaceFont();

  // Base theme with editor styling
  return EditorView.theme(
    {
      '&': {
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-foreground)',
        height: '100%',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.cm-content': {
        caretColor: 'var(--color-primary)',
        fontFamily,
        fontSize: '12px',
        lineHeight: '18px',
        paddingTop: '0',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--color-primary)',
      },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        {
          backgroundColor: 'var(--color-accent)',
        },
      '.cm-activeLine': {
        backgroundColor: 'var(--color-muted)',
      },
      '.cm-selectionMatch': {
        backgroundColor: 'hsl(var(--editor-selection-match) / 0.27)',
      },
      '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
        backgroundColor: 'hsl(var(--editor-bracket-match) / 0.1)',
        outline: '1px solid var(--color-border)',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-muted-foreground)',
        border: 'none',
        paddingLeft: '20px',
        ...(hideGutter && {display: 'none'}),
      },
      '.cm-gutterElement': {
        marginTop: '0',
        paddingRight: '0',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'var(--color-muted)',
      },
      '.cm-foldPlaceholder': {
        backgroundColor: 'var(--color-editor-fold-placeholder)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-foreground)',
      },
      '.cm-tooltip': {
        backgroundColor: 'var(--color-popover)',
        color: 'var(--color-popover-foreground)',
        border: '1px solid var(--color-border)',
      },
      '.cm-tooltip-hover': {
        backgroundColor: 'var(--color-popover)',
        color: 'var(--color-popover-foreground)',
        border: '1px solid var(--color-border)',
        padding: '4px 8px',
        borderRadius: '4px',
      },
      '.cm-tooltip-autocomplete': {
        '& > ul > li[aria-selected]': {
          backgroundColor: 'var(--color-accent)',
          color: 'var(--color-foreground)',
        },
      },
      '.cm-completionLabel': {
        color: 'var(--color-foreground)',
      },
      '.cm-completionDetail': {
        color: 'var(--color-muted-foreground)',
        fontStyle: 'italic',
      },
      '.cm-panels': {
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-foreground)',
      },
      '.cm-panels.cm-panels-top': {
        borderBottom: '1px solid var(--color-border)',
      },
      '.cm-panels.cm-panels-bottom': {
        borderTop: '1px solid var(--color-border)',
      },
      '.cm-searchMatch': {
        backgroundColor: 'hsl(var(--editor-search-match) / 0.2)',
        outline: '1px solid var(--color-border)',
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'var(--color-editor-search-match-selected)',
      },
      '.cm-button': {
        backgroundImage: 'none',
        backgroundColor: 'var(--color-accent)',
        color: 'var(--color-foreground)',
        border: '1px solid var(--color-border)',
      },
      '.cm-textfield': {
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-foreground)',
        border: '1px solid var(--color-border)',
      },
      // Lint gutter styling
      '.cm-lint-marker': {
        width: '1em',
        height: '1em',
      },
      '.cm-lint-marker-error': {
        content: '✗',
        color: 'var(--color-editor-lint-error)',
      },
      '.cm-lint-marker-warning': {
        content: '⚠',
        color: 'var(--color-editor-lint-warning)',
      },
      '.cm-diagnostic-error': {
        borderLeft: '3px solid var(--color-editor-lint-error)',
      },
      '.cm-diagnostic-warning': {
        borderLeft: '3px solid var(--color-editor-lint-warning)',
      },
    },
    {dark: theme === 'dark'},
  );
}
