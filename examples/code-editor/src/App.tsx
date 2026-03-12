import {useState} from 'react';
import {ThemeProvider, ThemeSwitch} from '@sqlrooms/ui';
import {EditorTypeSwitch, type EditorType} from './EditorTypeSwitch';
import {JavascriptEditor} from './JavascriptEditor';
import {JsonEditor} from './JsonEditor';
import {LanguageSwitch, type Language} from './LanguageSwitch';
import {SqlEditor} from './SqlEditor';

const AppContent: React.FC = () => {
  const [language, setLanguage] = useState<Language>('json');
  const [editorType, setEditorType] = useState<EditorType>('codemirror');

  return (
    <div className="bg-background flex h-screen flex-col">
      <header className="border-border bg-card border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground text-2xl font-bold">
              Code Editor Example
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Compare Monaco and CodeMirror editors with JSON, SQL, and
              JavaScript support
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitch value={language} onChange={setLanguage} />
            <EditorTypeSwitch value={editorType} onChange={setEditorType} />
            <ThemeSwitch />
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-hidden p-4">
            {/* JSON Editors */}
            {language === 'json' && (
              <JsonEditor editorType={editorType} className="h-full" />
            )}

            {/* DuckDB SQL Editors */}
            {language === 'duckdb' && (
              <SqlEditor editorType={editorType} className="h-full" />
            )}

            {/* JavaScript Editors */}
            {language === 'javascript' && (
              <JavascriptEditor editorType={editorType} className="h-full" />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider defaultTheme="system">
      <AppContent />
    </ThemeProvider>
  );
};
