import {EditorView, tooltips} from '@codemirror/view';

/**
 * Configures tooltips to use fixed positioning relative to the document body.
 * This allows tooltips to escape overflow:hidden containers (e.g., popovers, modals).
 */
export const tooltipTheme = [
  // Mount tooltips to document.body so they can escape overflow containers
  tooltips({
    parent: document.body,
  }),
  // Style adjustments for body-mounted tooltips
  EditorView.theme({
    '.cm-tooltip': {
      // Ensure proper z-index above other elements
      zIndex: '100000',
      padding: '0 !important',
    },
    '.cm-tooltip-lint': {
      // Lint tooltip styling
      fontSize: '12px',
      maxWidth: '400px',
      padding: '6px 8px !important',
    },
    '.cm-diagnostic': {
      // Individual error styling
      paddingTop: '0 !important',
      paddingBottom: '0 !important',
      margin: '0 !important',
      lineHeight: '1.5',
    },
    '.cm-diagnosticText': {
      // Error text styling
      fontSize: '12px',
      display: 'block',
    },
  }),
];
