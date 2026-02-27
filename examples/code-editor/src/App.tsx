import {useState} from 'react';
import {JsonCodeMirrorEditor} from '@sqlrooms/codemirror-editor';
import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {ThemeProvider, ThemeSwitch} from '@sqlrooms/ui';
import {EditorTypeSwitch, type EditorType} from './EditorTypeSwitch';

// Example JSON schema for a user profile
const userProfileSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Full name of the user',
      minLength: 2,
      maxLength: 50,
    },
    email: {
      type: 'string',
      description: 'Email address',
      format: 'email',
    },
    age: {
      type: 'number',
      description: 'Age in years',
      minimum: 18,
      maximum: 120,
    },
    status: {
      type: 'string',
      description: 'Account status',
      enum: ['active', 'inactive', 'pending', 'suspended'],
    },
    premium: {
      type: 'boolean',
      description: 'Premium membership status',
    },
    settings: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          enum: ['light', 'dark', 'auto'],
        },
        notifications: {
          type: 'boolean',
        },
      },
      required: ['theme'],
    },
  },
  required: ['name', 'email', 'status'],
};

// Example initial JSON data
const initialData = {
  name: 'John Doe',
  email: 'john@example.com',
  age: 28,
  status: 'active',
  premium: true,
  settings: {
    theme: 'dark',
    notifications: true,
  },
};

const AppContent: React.FC = () => {
  const [jsonValue, setJsonValue] = useState(
    JSON.stringify(initialData, null, 2),
  );
  const [editorType, setEditorType] = useState<EditorType>('codemirror');

  return (
    <div className="bg-background flex h-screen flex-col">
      <header className="border-border bg-card border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground text-2xl font-bold">
              Code Editor Example
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <EditorTypeSwitch value={editorType} onChange={setEditorType} />
            <ThemeSwitch />
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-hidden p-4">
            {editorType === 'monaco' && (
              <JsonMonacoEditor
                schema={userProfileSchema}
                value={jsonValue}
                onChange={(value) => setJsonValue(value || '')}
                className="h-full"
                options={{
                  minimap: {enabled: false},
                  lineNumbers: 'on',
                  wordWrap: 'on',
                }}
              />
            )}

            {editorType === 'codemirror' && (
              <JsonCodeMirrorEditor
                schema={userProfileSchema}
                value={jsonValue}
                onChange={(value) => setJsonValue(value)}
                className="h-full"
                options={{
                  lineNumbers: true,
                  lineWrapping: true,
                }}
              />
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
