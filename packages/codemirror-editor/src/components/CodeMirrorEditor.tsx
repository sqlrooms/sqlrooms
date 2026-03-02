import {EditorView, lineNumbers} from '@codemirror/view';
import {EditorState, Extension, StateEffect} from '@codemirror/state';
import {defaultKeymap, history, historyKeymap} from '@codemirror/commands';
import {keymap} from '@codemirror/view';
import {autocompletion, completionKeymap} from '@codemirror/autocomplete';
import {bracketMatching, foldGutter, foldKeymap} from '@codemirror/language';
import {searchKeymap, highlightSelectionMatches} from '@codemirror/search';
import {cn} from '@sqlrooms/ui';
import React, {useEffect, useMemo, useRef} from 'react';
import {createHighlightActiveLineTheme} from '../themes/highlight-active-line-theme';

export type CodeMirrorEditorOptions = {
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  highlightActiveLine?: boolean;
  highlightActiveLineGutter?: boolean;
  foldGutter?: boolean;
  autocompletion?: boolean;
};

export interface CodeMirrorEditorProps {
  /**
   * CSS class name for the editor container
   * @default ''
   */
  className?: string;
  value?: string;
  readOnly?: boolean;
  /**
   * Callback when the editor content changes
   */
  onChange?: (value: string) => void;
  /**
   * Callback when the editor view is mounted
   * Provides access to EditorView instance
   */
  onMount?: (view: EditorView) => void;
  /**
   * Additional CodeMirror extensions to apply
   */
  extensions?: Extension[];
  /**
   * Additional configuration options
   */
  options?: CodeMirrorEditorOptions;
}

/**
 * A wrapper around CodeMirror 6 editor with theme integration and language support
 */
export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  className,
  value = '',
  readOnly = false,
  onChange,
  onMount,
  extensions: userExtensions = [],
  options = {},
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref updated without triggering extensions reconfiguration.
  // The updateListener closure accesses onChangeRef.current to always use the latest
  // onChange callback, while avoiding expensive editor reconfigurations that would occur
  // if onChange was included in the extensions useMemo dependencies.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Build extensions array
  const extensions = useMemo(() => {
    const extensionsList: Extension[] = [];

    // Base editor features
    extensionsList.push(
      history(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...completionKeymap,
        ...foldKeymap,
        ...searchKeymap,
      ]),
    );

    // Optional features based on options
    if (options.lineNumbers !== false) {
      extensionsList.push(lineNumbers());
    }

    if (options.lineWrapping) {
      extensionsList.push(EditorView.lineWrapping);
    }

    if (options.highlightActiveLine !== false) {
      extensionsList.push(createHighlightActiveLineTheme());
    }

    if (options.foldGutter !== false) {
      extensionsList.push(foldGutter());
    }

    if (options.autocompletion !== false) {
      extensionsList.push(autocompletion());
    }

    // Bracket matching
    extensionsList.push(bracketMatching());

    // Highlight selection matches
    extensionsList.push(highlightSelectionMatches());

    // Read-only mode
    if (readOnly) {
      extensionsList.push(EditorState.readOnly.of(true));
      extensionsList.push(EditorView.editable.of(false));
    }

    // User extensions
    extensionsList.push(...userExtensions);

    // Update listener for onChange
    extensionsList.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChangeRef.current) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
    );

    return extensionsList;
  }, [
    readOnly,
    options.lineNumbers,
    options.lineWrapping,
    options.highlightActiveLine,
    options.foldGutter,
    options.autocompletion,
    userExtensions,
  ]);

  // Initialize editor on mount
  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    onMount?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle value updates
  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (value !== currentValue) {
      view.dispatch({
        changes: {from: 0, to: currentValue.length, insert: value || ''},
      });
    }
  }, [value]);

  // Handle extensions updates
  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    view.dispatch({
      effects: StateEffect.reconfigure.of(extensions),
    });
  }, [extensions]);

  return (
    <div className={cn('h-[300px] w-full', className)}>
      <div ref={editorRef} className="h-full w-full" />
    </div>
  );
};
