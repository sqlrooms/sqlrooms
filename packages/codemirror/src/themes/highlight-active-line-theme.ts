import {EditorView} from '@codemirror/view';
import {Extension} from '@codemirror/state';

export function createHighlightActiveLineTheme(): Extension {
  return EditorView.theme({
    '.cm-activeLine': {
      backgroundColor: 'var(--cm-activeLine-bg, rgba(0, 0, 0, 0.05))',
    },
  });
}
