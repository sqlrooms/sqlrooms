import {EditorView} from '@codemirror/view';
import {Extension} from '@codemirror/state';
import {startCompletion} from '@codemirror/autocomplete';

/**
 * Creates an extension that automatically triggers completions when a quote character is typed
 * This mimics Monaco's behavior for JSON editing
 * @returns CodeMirror extension
 */
export function autoTriggerOnQuote(): Extension {
  return EditorView.updateListener.of((update) => {
    // Only react to document changes (user typing)
    if (!update.docChanged) {
      return;
    }

    // Check if any change included a quote character
    let insertedQuote = false;

    update.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
      const text = inserted.toString();
      // Check if the inserted text is a quote (could be single or double)
      if (/^["']$/.test(text)) {
        insertedQuote = true;
      }
    });

    if (insertedQuote) {
      // Defer trigger to next animation frame to avoid interfering with typing
      requestAnimationFrame(() => {
        try {
          startCompletion(update.view);
        } catch (error) {
          // Silently fail if completion can't be triggered
          console.debug('Could not trigger completion:', error);
        }
      });
    }
  });
}
