import {keymap} from '@codemirror/view';
import {Prec} from '@codemirror/state';
import type {Extension} from '@codemirror/state';
import type {EditorView} from '@codemirror/view';

/** Creates keymap extension with Cmd+Enter to run query */
export function createSqlKeymap(
  onRunQuery?: (query: string) => void,
): Extension {
  if (!onRunQuery) {
    // No keyboard shortcut if callback not provided
    return [];
  }

  return Prec.high(
    keymap.of([
      {
        key: 'Mod-Enter', // Cmd on Mac, Ctrl on Windows/Linux
        run: (view: EditorView) => {
          const {state} = view;
          const selection = state.selection.main;

          // Get selected text or full document
          const query = selection.empty
            ? state.doc.toString()
            : state.sliceDoc(selection.from, selection.to);

          onRunQuery(query);
          return true; // Prevent default behavior
        },
      },
    ]),
  );
}
