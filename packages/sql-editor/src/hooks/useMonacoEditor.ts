import {useRef, useState, useEffect} from 'react';

type EditorInstance = any;
type MonacoInstance = any;

/**
 * Hook for managing Monaco editor instances and keyboard shortcuts
 */
export function useMonacoEditor() {
  const [editorInstances, setEditorInstances] = useState<
    Record<string, EditorInstance>
  >({});
  const handleRunQueryRef = useRef<() => Promise<void>>(async () => {});

  /**
   * Handle editor mounting and setup keyboard shortcuts
   */
  const handleEditorMount = (
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
  };

  /**
   * Get selected text or entire query from the editor
   */
  const getQueryText = (queryId: string, defaultQuery: string): string => {
    const editor = editorInstances[queryId];
    if (!editor) return defaultQuery;

    const selection = editor.getSelection();
    if (selection && !selection.isEmpty()) {
      const selectedText = editor.getModel().getValueInRange(selection);
      if (selectedText) {
        return selectedText;
      }
    }

    return defaultQuery;
  };

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
    setRunQueryHandler: (handler: () => Promise<void>) => {
      handleRunQueryRef.current = handler;
    },
  };
}
