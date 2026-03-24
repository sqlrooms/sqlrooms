import {EditorView, tooltips} from '@codemirror/view';
import {getMonospaceFont} from '@sqlrooms/utils';

export const tooltipTheme = [
  // Mount tooltips to document.body so they can escape overflow containers
  // Use a getter to avoid accessing document at module load time (safe for SSR/tests)
  tooltips({
    get parent() {
      return typeof document !== 'undefined' ? document.body : undefined;
    },
  }),

  EditorView.theme({
    '.cm-tooltip': {
      // Ensure proper z-index above other elements
      zIndex: '100000',
      padding: '0 !important',
    },
    '.cm-tooltip-lint': {
      fontSize: '12px',
      fontFamily: getMonospaceFont(),
      maxWidth: '500px',
      padding: '4px 0 !important',
      lineHeight: '18px',
    },
    '.cm-diagnostic': {
      padding: '0 !important',
      margin: '0 !important',
      lineHeight: '1.6',
      '&:not(:first-child)': {
        borderTop: '1px solid var(--color-border)',
        marginTop: '8px !important',
        paddingTop: '8px !important',
      },
    },
    '.cm-diagnosticText': {
      fontSize: '12px',
      display: 'block',
      fontFamily: 'inherit',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      lineHeight: '18px',
      color: 'var(--color-foreground)',
      padding: 0,
    },
  }),
];
