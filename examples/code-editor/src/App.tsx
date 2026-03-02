import {useState} from 'react';
import {type DataTable} from '@sqlrooms/duckdb';
import {ThemeProvider, ThemeSwitch} from '@sqlrooms/ui';
import {EditorTypeSwitch, type EditorType} from './EditorTypeSwitch';
import {JavascriptEditor} from './JavascriptEditor';
import {JsonEditor} from './JsonEditor';
import {LanguageSwitch, type Language} from './LanguageSwitch';
import {SqlEditor} from './SqlEditor';

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

// Example SQL query
const initialSqlQuery = `-- Sample SQL query
SELECT
  id,
  name,
  email,
  status,
  created_at
FROM users
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 10;`;

// Example JavaScript code
const initialJavascriptCode = `// Sample JavaScript code
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Calculate first 10 Fibonacci numbers
const numbers = Array.from({length: 10}, (_, i) => fibonacci(i));
console.log('Fibonacci sequence:', numbers);

// Example async function
async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

export {fibonacci, fetchData};`;

// Example table schemas for SQL autocomplete
const tableSchemas: DataTable[] = [
  {
    table: {
      table: 'users',
      toString: () => 'users',
    },
    isView: false,
    schema: 'main',
    tableName: 'users',
    columns: [
      {name: 'id', type: 'INTEGER'},
      {name: 'name', type: 'VARCHAR'},
      {name: 'email', type: 'VARCHAR'},
      {name: 'age', type: 'INTEGER'},
      {name: 'status', type: 'VARCHAR'},
      {name: 'created_at', type: 'TIMESTAMP'},
    ],
  },
  {
    table: {
      table: 'orders',
      toString: () => 'orders',
    },
    isView: false,
    schema: 'main',
    tableName: 'orders',
    columns: [
      {name: 'id', type: 'INTEGER'},
      {name: 'user_id', type: 'INTEGER'},
      {name: 'product_name', type: 'VARCHAR'},
      {name: 'amount', type: 'DECIMAL'},
      {name: 'order_date', type: 'TIMESTAMP'},
    ],
  },
];

const AppContent: React.FC = () => {
  const [jsonValue, setJsonValue] = useState(
    JSON.stringify(initialData, null, 2),
  );
  const [sqlValue, setSqlValue] = useState(initialSqlQuery);
  const [javascriptValue, setJavascriptValue] = useState(initialJavascriptCode);
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
              <JsonEditor
                editorType={editorType}
                schema={userProfileSchema}
                value={jsonValue}
                onChange={setJsonValue}
                className="h-full"
              />
            )}

            {/* DuckDB SQL Editors */}
            {language === 'duckdb' && (
              <SqlEditor
                editorType={editorType}
                tableSchemas={tableSchemas}
                value={sqlValue}
                onChange={setSqlValue}
                onRunQuery={(query: string) => {
                  console.log('Run query:', query);
                  alert(`Would execute query:\n\n${query}`);
                }}
                className="h-full"
              />
            )}

            {/* JavaScript Editors */}
            {language === 'javascript' && (
              <JavascriptEditor
                editorType={editorType}
                value={javascriptValue}
                onChange={setJavascriptValue}
                className="h-full"
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
