import React, {useRef, useEffect} from 'react';
import {
  Editor,
  EditorProps,
  OnMount,
  OnChange,
  loader,
} from '@monaco-editor/react';
import {Spinner, cn} from '@sqlrooms/ui';

// Configure the Monaco loader
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs',
  },
});

export interface MonacoEditorProps extends Omit<EditorProps, 'onMount'> {
  /**
   * Callback when the editor is mounted
   */
  onMount?: OnMount;
  /**
   * Callback when the editor content changes
   */
  onChange?: OnChange;
  /**
   * CSS class name for the editor container
   * @default ''
   */
  className?: string;
  /**
   * The language of the editor
   * @default 'javascript'
   */
  language?: string;
  /**
   * The theme of the editor
   * @default 'vs-dark'
   */
  theme?: 'vs-dark' | 'light';
  /**
   * The value of the editor
   */
  value?: string;
  /**
   * Whether the editor is read-only
   * @default false
   */
  readOnly?: boolean;
  /**
   * Additional options for the editor
   */
  options?: Record<string, any>;
}

/**
 * A wrapper around the Monaco Editor component
 */
export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  className,
  language = 'javascript',
  theme = 'vs-dark',
  value = '',
  readOnly = false,
  onMount,
  onChange,
  options = {},
  ...props
}) => {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    if (onMount) {
      onMount(editor, monaco);
    }
  };

  // Apply readOnly option
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({readOnly});
    }
  }, [readOnly]);

  const defaultOptions = {
    minimap: {enabled: false},
    scrollBeyondLastLine: false,
    automaticLayout: true,
    readOnly,
    ...options,
  };

  return (
    <div className={cn('w-full h-[300px]', className)}>
      <Editor
        height="100%"
        width="100%"
        language={language}
        theme={theme}
        value={value}
        options={defaultOptions}
        onMount={handleEditorDidMount}
        onChange={onChange}
        loading={<Spinner />}
        {...props}
      />
    </div>
  );
};
