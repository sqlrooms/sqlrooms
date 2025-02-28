import React, {useRef, useEffect} from 'react';
import {
  Editor,
  EditorProps,
  OnMount,
  OnChange,
  loader,
} from '@monaco-editor/react';
import {Spinner, cn, useTheme} from '@sqlrooms/ui';

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
   * Can be explicitly set or will automatically use the app theme if not provided
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
  theme: explicitTheme,
  value = '',
  readOnly = false,
  onMount,
  onChange,
  options = {},
  ...props
}) => {
  // Get the app theme from the ThemeProvider
  const {theme: appTheme} = useTheme();

  // If a theme is explicitly provided, use it. Otherwise, determine from the app theme
  const theme =
    explicitTheme ||
    (appTheme === 'dark' ||
    (appTheme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'vs-dark'
      : 'light');

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

  // Update the editor theme when app theme changes
  useEffect(() => {
    if (editorRef.current && !explicitTheme) {
      const newTheme =
        appTheme === 'dark' ||
        (appTheme === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
          ? 'vs-dark'
          : 'light';

      // Only update if the theme has changed
      if (newTheme !== theme) {
        // The Monaco editor requires us to set the theme via the monaco instance
        // We can access it through the editor's _themeService but this is not ideal
        // A better approach would be to get the monaco instance and use monaco.editor.setTheme
        // However, we'll use this approach as it should work for now
        if (editorRef.current._themeService) {
          editorRef.current._themeService.setTheme(newTheme);
        }
      }
    }
  }, [appTheme, explicitTheme, theme]);

  // Listen for system theme changes if using system theme
  useEffect(() => {
    if (appTheme === 'system' && !explicitTheme) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        if (editorRef.current && editorRef.current._themeService) {
          editorRef.current._themeService.setTheme(
            mediaQuery.matches ? 'vs-dark' : 'light',
          );
        }
      };

      // Add listener for theme changes
      mediaQuery.addEventListener('change', handleChange);

      // Clean up
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  }, [appTheme, explicitTheme]);

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
