import {Editor, EditorProps, OnChange, OnMount} from '@monaco-editor/react';
import {Spinner, cn, useTheme} from '@sqlrooms/ui';
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  getCssColor,
  getJsonEditorTheme,
  getMenuColors,
  getMonospaceFont,
} from '../utils/color-utils';
import type * as Monaco from 'monaco-editor';

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
  options?: Monaco.editor.IStandaloneEditorConstructionOptions;
}

const DEFAULT_MONACO_OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions =
  {
    minimap: {enabled: false},
    scrollBeyondLastLine: false,
    automaticLayout: true,
    fontLigatures: true,
    fixedOverflowWidgets: true,
  };
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
  const {theme: appTheme} = useTheme();

  // Track system dark preference without setState-in-effect
  const systemPrefersDark = useSyncExternalStore(
    (onStoreChange) => {
      if (appTheme !== 'system' || typeof window === 'undefined') {
        return () => {};
      }
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', onStoreChange);
      return () => mediaQuery.removeEventListener('change', onStoreChange);
    },
    () => {
      if (appTheme !== 'system' || typeof window === 'undefined') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    },
    () => false,
  );

  const isDark =
    explicitTheme === 'vs-dark'
      ? true
      : explicitTheme === 'light'
        ? false
        : appTheme === 'dark' || (appTheme === 'system' && systemPrefersDark);

  // Determine editor theme name passed to the Editor component
  const theme = isDark ? 'vs-dark' : 'light';

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Special language configuration for JSON
    if (language === 'json') {
      // Define a more robust tokenizer for JSON with improved rules
      monaco.languages.setMonarchTokensProvider('json', {
        tokenizer: {
          root: [
            // Property keys (strings followed by a colon)
            [/"([^"]*)"(?=\s*:)/, 'string.key.json'],

            // Regular string values (any quoted string not followed by a colon)
            [/"([^"]*)"(?!\s*:)/, 'string.value.json'],

            // Numbers (integers, decimals, and scientific notation)
            [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],

            // Keywords
            [/\b(?:true|false|null)\b/, 'keyword'],

            // Punctuation and delimiters
            [/[{}[\],:]/, 'delimiter'],
          ],
        },
      });
    }

    // Define editor themes with Tailwind CSS variables
    monaco.editor.defineTheme('sqlrooms-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': getCssColor('--background', '#ffffff'),
        'editor.foreground': getCssColor('--foreground', '#000000'),
        'editor.lineHighlightBackground': getCssColor('--muted', '#f5f5f5'),
        'editorCursor.foreground': getCssColor('--primary', '#000000'),
        'editor.selectionBackground': getCssColor('--accent', '#e3e3e3'),
        'editorLineNumber.foreground': getCssColor(
          '--muted-foreground',
          '#888888',
        ),
        ...getMenuColors(false),
      },
    });

    monaco.editor.defineTheme('sqlrooms-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': getCssColor('--background', '#1e1e1e'),
        'editor.foreground': getCssColor('--foreground', '#d4d4d4'),
        'editor.lineHighlightBackground': getCssColor('--muted', '#2a2a2a'),
        'editorCursor.foreground': getCssColor('--primary', '#ffffff'),
        'editor.selectionBackground': getCssColor('--accent', '#264f78'),
        'editorLineNumber.foreground': getCssColor(
          '--muted-foreground',
          '#858585',
        ),
        ...getMenuColors(true),
      },
    });

    // Define JSON-specific themes with rich token coloring
    monaco.editor.defineTheme('sqlrooms-json-light', getJsonEditorTheme(false));
    monaco.editor.defineTheme('sqlrooms-json-dark', getJsonEditorTheme(true));

    // Apply the custom theme based on content type
    const isDarkMount =
      explicitTheme === 'vs-dark'
        ? true
        : explicitTheme === 'light'
          ? false
          : appTheme === 'dark' ||
            (appTheme === 'system' &&
              window.matchMedia('(prefers-color-scheme: dark)').matches);

    // Use JSON-specific theme for JSON files
    if (language === 'json') {
      monaco.editor.setTheme(
        isDarkMount ? 'sqlrooms-json-dark' : 'sqlrooms-json-light',
      );
    } else {
      monaco.editor.setTheme(isDarkMount ? 'sqlrooms-dark' : 'sqlrooms-light');
    }

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
    if (editorRef.current && monacoRef.current) {
      const targetDark =
        explicitTheme === 'vs-dark'
          ? true
          : explicitTheme === 'light'
            ? false
            : isDark;

      // Use JSON-specific theme for JSON files
      if (language === 'json') {
        monacoRef.current.editor.setTheme(
          targetDark ? 'sqlrooms-json-dark' : 'sqlrooms-json-light',
        );
      } else {
        monacoRef.current.editor.setTheme(
          targetDark ? 'sqlrooms-dark' : 'sqlrooms-light',
        );
      }
    }
  }, [appTheme, explicitTheme, isDark, language]);

  // Listen for system theme changes if using system theme
  useEffect(() => {
    if (appTheme === 'system' && !explicitTheme && monacoRef.current) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        if (monacoRef.current) {
          // Use JSON-specific theme for JSON files
          if (language === 'json') {
            monacoRef.current.editor.setTheme(
              mediaQuery.matches ? 'sqlrooms-json-dark' : 'sqlrooms-json-light',
            );
          } else {
            monacoRef.current.editor.setTheme(
              mediaQuery.matches ? 'sqlrooms-dark' : 'sqlrooms-light',
            );
          }
        }
      };

      // Add listener for theme changes
      mediaQuery.addEventListener('change', handleChange);

      // Clean up
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  }, [appTheme, explicitTheme, language]);

  // Get monospace font for code editor
  const fontFamily = getMonospaceFont();

  const combinedOptions = useMemo(
    () => ({
      ...DEFAULT_MONACO_OPTIONS,
      readOnly,
      fontFamily,
      ...options,
    }),
    [options, fontFamily, readOnly],
  );

  // Force remount when theme or language changes so Monaco applies the scheme.
  const [renderKey, setRenderKey] = useState(`${theme}-${language}`);
  useEffect(() => {
    setRenderKey(`${theme}-${language}`);
  }, [theme, language]);
  return (
    <div className={cn('h-[300px] w-full', className)}>
      <Editor
        height="100%"
        width="100%"
        language={language}
        theme={theme}
        value={value}
        options={combinedOptions}
        onMount={handleEditorDidMount}
        onChange={onChange}
        loading={<Spinner />}
        key={renderKey}
        {...props}
      />
    </div>
  );
};
