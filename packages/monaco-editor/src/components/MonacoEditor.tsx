import {Editor, EditorProps, OnChange, OnMount} from '@monaco-editor/react';
import {Spinner, cn, useTheme} from '@sqlrooms/ui';
import React, {useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import {
  getCssColor,
  getJsonEditorTheme,
  getMenuColors,
  getMonospaceFont,
} from '../utils/color-utils';
import type * as Monaco from 'monaco-editor';

// Rendering issue fix for white rectangle appearing above text in Monaco.
// Monaco creates a hidden textarea for IME input. If Monaco CSS loads late,
// this textarea can briefly render as a normal white block and shift content.
// Force it to never participate in layout / painting.
let isImeTextareaStyleInjected = false;
function suppressMonacoTextareaFlash() {
  if (isImeTextareaStyleInjected) return;
  if (typeof document === 'undefined') return;
  isImeTextareaStyleInjected = true;

  const style = document.createElement('style');
  style.setAttribute('data-sqlrooms-monaco-ime-style', 'true');
  style.textContent = `
    .monaco-editor textarea.ime-text-area {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 1px !important;
      height: 1px !important;
      opacity: 0 !important;
      background: transparent !important;
      color: transparent !important;
      border: 0 !important;
      padding: 0 !important;
      margin: 0 !important;
      pointer-events: none !important;
      z-index: -1 !important;
    }
  `;
  document.head.appendChild(style);
}

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

let themesDefined = false;
function withRootThemeClass<T>(themeClass: 'light' | 'dark', fn: () => T): T {
  if (typeof document === 'undefined') return fn();

  const root = document.documentElement;
  const hadLight = root.classList.contains('light');
  const hadDark = root.classList.contains('dark');

  root.classList.remove('light', 'dark');
  root.classList.add(themeClass);

  try {
    return fn();
  } finally {
    root.classList.remove('light', 'dark');
    if (hadLight) root.classList.add('light');
    if (hadDark) root.classList.add('dark');
  }
}

function defineSqlroomsThemes(monaco: typeof Monaco) {
  if (themesDefined) return;
  themesDefined = true;

  // IMPORTANT:
  // Our Tailwind CSS variables change between `.light` and `.dark`.
  // If we define themes while the app is in dark mode, then `sqlrooms-light`
  // would incorrectly capture dark colors (and vice versa). To avoid all the
  // "light first, then flips" + tab flicker, we read CSS vars under each class.

  withRootThemeClass('light', () => {
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

    monaco.editor.defineTheme('sqlrooms-json-light', getJsonEditorTheme(false));
  });

  withRootThemeClass('dark', () => {
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

    monaco.editor.defineTheme('sqlrooms-json-dark', getJsonEditorTheme(true));
  });
}

function setupMonacoThemes(monaco: typeof Monaco) {
  suppressMonacoTextareaFlash();

  // Define themes once, but with the correct CSS vars for each mode.
  defineSqlroomsThemes(monaco);
}

const DEFAULT_MONACO_OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions =
  {
    minimap: {enabled: false},
    scrollBeyondLastLine: false,
    automaticLayout: true,
    fontLigatures: true,
    fixedOverflowWidgets: true,
    // Prevent an initial top "reserved" area that can appear briefly while Monaco
    // computes sticky scroll layout (shows up as a blank/white rectangle above text).
    stickyScroll: {enabled: false} as any,
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
  beforeMount,
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

  const monacoTheme =
    language === 'json'
      ? isDark
        ? 'sqlrooms-json-dark'
        : 'sqlrooms-json-light'
      : isDark
        ? 'sqlrooms-dark'
        : 'sqlrooms-light';

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const handleBeforeMount: NonNullable<EditorProps['beforeMount']> = (
    monaco,
  ) => {
    suppressMonacoTextareaFlash();
    setupMonacoThemes(monaco);
    beforeMount?.(monaco);
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Safety: in case beforeMount didn't run for any reason.
    setupMonacoThemes(monaco);

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

  return (
    <div className={cn('h-[300px] w-full', className)}>
      <Editor
        height="100%"
        width="100%"
        language={language}
        theme={monacoTheme}
        value={value}
        options={combinedOptions}
        beforeMount={handleBeforeMount}
        onMount={handleEditorDidMount}
        onChange={onChange}
        loading={<Spinner />}
        {...props}
      />
    </div>
  );
};
