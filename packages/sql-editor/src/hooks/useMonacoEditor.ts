import {useRef, useState, useEffect, useCallback} from 'react';

type EditorInstance = any;
type MonacoInstance = any;

/**
 * Hook for managing Monaco editor instances and keyboard shortcuts
 */
export function useMonacoEditor() {
  // Store editor instances for each query tab
  const [editorInstances, setEditorInstances] = useState<
    Record<string, EditorInstance>
  >({});

  // Use a ref for the run query function to avoid dependency issues
  // This ref is NOT for Zustand selectors, it's for function reference stability
  const handleRunQueryRef = useRef<() => Promise<void>>(async () => {});

  /**
   * Set the run query handler reference
   */
  const setRunQueryHandler = useCallback((handler: () => Promise<void>) => {
    handleRunQueryRef.current = handler;
  }, []);

  /**
   * Handle editor mounting and setup keyboard shortcuts
   */
  const handleEditorMount = useCallback(
    (
      editor: EditorInstance,
      monaco: MonacoInstance,
      queryId: string,
      onRunQuery: () => Promise<void>,
    ) => {
      // Store the editor instance
      setEditorInstances((prev) => ({
        ...prev,
        [queryId]: editor,
      }));

      // Add Cmd/Ctrl+Enter keyboard shortcut to run query
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        void handleRunQueryRef.current();
      });
    },
    [],
  );

  /**
   * Get selected text or entire query from the editor
   */
  const getQueryText = useCallback(
    (queryId: string, defaultQuery: string): string => {
      const editor = editorInstances[queryId];
      if (!editor) return defaultQuery;

      const selection = editor.getSelection();
      if (
        selection &&
        !selection.isEmpty() &&
        typeof editor.getModel().getValueInRange === 'function'
      ) {
        // Return selected text
        return editor.getModel().getValueInRange(selection);
      }

      // Return the entire query if no selection
      return defaultQuery;
    },
    [editorInstances],
  );

  /**
   * Setup global keyboard shortcuts for running queries
   */
  useEffect(() => {
    // This global event listener is a fallback for when the editor doesn't have focus
    const handleKeyDown = (evt: Event) => {
      if (
        evt instanceof KeyboardEvent &&
        evt.key === 'Enter' &&
        (evt.metaKey || evt.ctrlKey || evt.shiftKey)
      ) {
        // Check if the event target is not part of the Monaco editor
        const target = evt.target as HTMLElement;
        const isMonacoEditor = target.closest('.monaco-editor');

        // Only handle the event if it's not already being handled by Monaco
        if (!isMonacoEditor) {
          void handleRunQueryRef.current();
        }
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);

    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return {
    editorInstances,
    handleEditorMount,
    getQueryText,
    setRunQueryHandler,
  };
}
