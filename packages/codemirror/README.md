# @sqlrooms/codemirror

CodeMirror 6 editor components for SQLRooms with theme integration, DuckDB SQL support, JSON schema validation, and JavaScript/JSX editing.

A lightweight alternative to `@sqlrooms/monaco-editor`. Perfect for data-focused applications that need fast, efficient code editors.

## Features

- 🎨 **Theme Integration** - Seamless integration with SQLRooms theme system (light/dark/system)
- 🌐 **Language Support** - JavaScript/JSX, JSON, and DuckDB SQL syntax highlighting
- 🦆 **DuckDB SQL Dialect** - Schema-aware completions, hover tooltips, and Cmd+Enter execution
- ✅ **JSON Schema Validation** - Real-time validation with inline error markers
- 💡 **Schema-based Autocomplete** - Intelligent completions for JSON and SQL editing
- 🔒 **Read-only Mode** - Support for non-editable views
- 🎯 **Similar API** - Familiar interface for Monaco users with component parity

## Installation

```bash
pnpm add @sqlrooms/codemirror
```

## Quick Start

### JavaScript Editor

```tsx
import {JavascriptCodeMirrorEditor} from '@sqlrooms/codemirror';
import {FC, useState} from 'react';

const MyEditor: FC = () => {
  const [code, setCode] = useState('console.log("Hello, world!");');

  return (
    <JavascriptCodeMirrorEditor
      value={code}
      onChange={setCode}
      className="h-96"
    />
  );
};
```

### JSON Editor with Schema Validation

```tsx
import {JsonCodeMirrorEditor} from '@sqlrooms/codemirror';
import {FC, useState} from 'react';

const schema = {
  type: 'object',
  properties: {
    name: {type: 'string', description: 'User name'},
    age: {type: 'number', minimum: 0},
    email: {type: 'string', format: 'email'},
  },
  required: ['name', 'email'],
};

const MyJsonEditor: FC = () => {
  const [json, setJson] = useState('{\n  "name": ""\n}');

  return (
    <JsonCodeMirrorEditor
      schema={schema}
      value={json}
      onChange={setJson}
      className="h-96"
    />
  );
};
```

### SQL Editor with DuckDB Dialect

```tsx
import {DuckdbCodeMirrorEditor} from '@sqlrooms/codemirror';
import {FC, useState} from 'react';

const MySqlEditor: FC = () => {
  const [sql, setSql] = useState('SELECT * FROM users;');

  return (
    <DuckdbCodeMirrorEditor
      value={sql}
      onChange={setSql}
      tableSchemas={tableSchemas}
      onRunQuery={(query) => executeQuery(query)}
    />
  );
};
```

## Components

The package exports four editor components:

1. **CodeMirrorEditor** - Base editor component (requires manual configuration)
2. **JsonCodeMirrorEditor** - JSON editor with schema validation and autocomplete
3. **DuckdbCodeMirrorEditor** - SQL editor with DuckDB dialect and schema-aware completions
4. **JavascriptCodeMirrorEditor** - JavaScript/JSX editor with syntax highlighting

### CodeMirrorEditor

Base editor component without built-in language or theme support. Use this for custom configurations or when you need full control over extensions.

#### Props

```typescript
interface CodeMirrorEditorProps {
  className?: string; // CSS class for container
  value?: string; // Editor content
  readOnly?: boolean; // Read-only mode (default: false)
  onChange?: (value: string) => void; // Content change callback
  onMount?: (view: EditorView) => void; // Mount callback with EditorView
  onValidate?: (diagnostics: CodeMirrorDiagnostic[]) => void; // Validation callback
  extensions?: Extension[]; // Additional CodeMirror extensions
  options?: {
    lineNumbers?: boolean; // Show line numbers (default: true)
    lineWrapping?: boolean; // Wrap long lines (default: false)
    highlightActiveLine?: boolean; // Highlight current line (default: true)
    highlightActiveLineGutter?: boolean; // Highlight gutter for active line
    foldGutter?: boolean; // Show code folding gutter (default: true)
    autocompletion?: boolean; // Enable autocomplete (default: true)
  };
}

interface CodeMirrorDiagnostic {
  from: number; // Start position
  to: number; // End position
  severity: 'error' | 'warning' | 'info'; // Severity level
  message: string; // Error/warning message
}
```

#### Example

```tsx
import {CodeMirrorEditor} from '@sqlrooms/codemirror';
import {javascript} from '@codemirror/lang-javascript';
import {FC, useState} from 'react';

const MyEditor: FC = () => {
  const [code, setCode] = useState('');

  return (
    <CodeMirrorEditor
      value={code}
      onChange={setCode}
      extensions={[javascript()]}
      onMount={(view) => {
        console.log('Editor mounted:', view);
      }}
      onValidate={(diagnostics) => {
        console.log('Validation errors:', diagnostics);
      }}
      options={{
        lineNumbers: true,
        lineWrapping: true,
        foldGutter: true,
      }}
    />
  );
};
```

### JsonCodeMirrorEditor

JSON editor with schema validation and autocomplete.

#### Props

```typescript
interface JsonCodeMirrorEditorProps extends Omit<
  CodeMirrorEditorProps,
  'value'
> {
  schema?: object; // JSON schema for validation
  value?: string | object; // JSON value (auto-stringifies objects)
  theme?: 'dark' | 'light' | 'system'; // Theme override (auto-detects if not set)
  hideGutter?: boolean; // Hide line numbers and gutter
  // Inherits from CodeMirrorEditorProps:
  // - onChange?: (value: string) => void
  // - onValidate?: (diagnostics: CodeMirrorDiagnostic[]) => void
  // - onMount?: (view: EditorView) => void
  // - readOnly?: boolean
  // - className?: string
  // - options?: CodeMirrorEditorOptions
  // - extensions?: Extension[]
}
```

#### Features

- **Automatic Validation**: Real-time JSON schema validation with inline error markers
- **Schema-based Autocomplete**: Intelligent completions for property names and values
- **Auto-trigger**: Completions automatically triggered when typing quotes
- **Format on Paste**: Automatically formats JSON when pasted
- **Object Support**: Accepts objects and automatically converts to formatted JSON

#### Example

```tsx
import {JsonCodeMirrorEditor} from '@sqlrooms/codemirror';
import {FC, useState} from 'react';

const schema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['active', 'inactive'],
      description: 'User status',
    },
    count: {
      type: 'number',
      minimum: 0,
      maximum: 100,
    },
  },
  required: ['status'],
};

const MyJsonEditor: FC = () => {
  const [json, setJson] = useState({status: 'active'});
  const [errors, setErrors] = useState([]);

  return (
    <div>
      <JsonCodeMirrorEditor
        schema={schema}
        value={json}
        onChange={setJson}
        onValidate={(diagnostics) => {
          const schemaErrors = diagnostics.filter(
            (d) => d.severity === 'error',
          );
          setErrors(schemaErrors);
        }}
        options={{
          lineNumbers: false,
          lineWrapping: true,
        }}
      />
      {errors.length > 0 && (
        <div className="text-red-500">
          {errors.map((err, i) => (
            <div key={i}>{err.message}</div>
          ))}
        </div>
      )}
    </div>
  );
};
```

### DuckdbCodeMirrorEditor

SQL editor with DuckDB dialect support, schema-aware autocompletion, and hover tooltips.

#### Props

```typescript
interface DuckdbCodeMirrorEditorProps extends Omit<
  CodeMirrorEditorProps,
  'extensions'
> {
  connector?: DuckDbConnector; // DuckDB connector for dynamic suggestions
  customKeywords?: string[]; // Custom SQL keywords for completion
  customFunctions?: string[]; // Custom SQL functions for completion
  tableSchemas?: DataTable[]; // Table schemas for autocompletion/hover
  getLatestSchemas?: () => {tableSchemas: DataTable[]}; // Callback for fresh schemas
  onRunQuery?: (query: string) => void; // Cmd+Enter callback (runs selected text or full doc)
  theme?: 'dark' | 'light' | 'system'; // Theme override (auto-detects if not set)
}
```

#### Features

- **DuckDB Dialect**: Syntax highlighting for DuckDB-specific SQL
- **Schema-aware Completions**: Autocomplete table names, column names, and functions
- **Hover Tooltips**: Show table/column schemas and function signatures
- **Keyword Execution**: Press Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) to run query
- **Custom Vocabulary**: Add custom keywords and functions for completion

#### Example

```tsx
import {DuckdbCodeMirrorEditor} from '@sqlrooms/codemirror';
import {useDuckDb} from '@sqlrooms/duckdb';
import {FC, useState} from 'react';

const SqlEditor: FC = () => {
  const [sql, setSql] = useState('SELECT * FROM users WHERE age > 18;');
  const {connector, tableSchemas} = useDuckDb();

  const handleRunQuery = async (query: string) => {
    const result = await connector.query(query);
    console.log('Query result:', result);
  };

  return (
    <DuckdbCodeMirrorEditor
      value={sql}
      onChange={setSql}
      connector={connector}
      tableSchemas={tableSchemas}
      onRunQuery={handleRunQuery}
      customKeywords={['PIVOT', 'UNPIVOT']}
      customFunctions={['my_custom_udf']}
    />
  );
};
```

### JavascriptCodeMirrorEditor

JavaScript editor with JSX support and syntax highlighting.

#### Props

```typescript
interface JavascriptCodeMirrorEditorProps extends CodeMirrorEditorProps {
  theme?: 'dark' | 'light' | 'system'; // Theme override (auto-detects if not set)
}
```

#### Features

- **JSX Support**: Full support for React JSX syntax
- **JavaScript Syntax**: Modern JavaScript syntax highlighting
- **Auto-completion**: Intelligent code completion for JavaScript
- **Theme Integration**: Seamless SQLRooms theme integration

#### Example

```tsx
import {JavascriptCodeMirrorEditor} from '@sqlrooms/codemirror';
import {FC, useState} from 'react';

const JsEditor: FC = () => {
  const [code, setCode] = useState(
    `
function HelloWorld() {
  return <div>Hello, world!</div>;
}
  `.trim(),
  );

  return (
    <JavascriptCodeMirrorEditor
      value={code}
      onChange={setCode}
      options={{
        lineNumbers: true,
        lineWrapping: true,
      }}
    />
  );
};
```

## Theme Integration

All specialized editor components (`JsonCodeMirrorEditor`, `DuckdbCodeMirrorEditor`, `JavascriptCodeMirrorEditor`) automatically integrate with SQLRooms' theme system:

- **Light Mode**: Uses light theme colors from CSS variables
- **Dark Mode**: Uses dark theme colors from CSS variables
- **System Preference**: Automatically detects and follows system dark mode preference

The base `CodeMirrorEditor` component does not include automatic theme integration. You must provide theme extensions manually:

```tsx
import {CodeMirrorEditor} from '@sqlrooms/codemirror';
import {javascript} from '@codemirror/lang-javascript';
import {FC, useState} from 'react';
// Note: Theme extensions are internal - use specialized components for automatic theming

const MyEditor: FC = () => {
  const [code, setCode] = useState('');

  return <CodeMirrorEditor value={code} onChange={setCode} extensions={[javascript()]} />;
};
```

### Custom Theme Override

Specialized components allow explicit theme override:

```tsx
import {
  JsonCodeMirrorEditor,
  DuckdbCodeMirrorEditor,
  JavascriptCodeMirrorEditor,
} from '@sqlrooms/codemirror';
import {FC} from 'react';

interface MyEditorsProps {
  json: object;
  sql: string;
  code: string;
}

const MyEditors: FC<MyEditorsProps> = ({json, sql, code}) => {
  return (
    <>
      <JsonCodeMirrorEditor theme="dark" value={json} schema={schema} />
      <DuckdbCodeMirrorEditor theme="light" value={sql} />
      <JavascriptCodeMirrorEditor theme="system" value={code} />
    </>
  );
};
```

### Theme Colors

Themes use CSS variables (HSL format without `hsl()` wrapper). These variables are defined in `@sqlrooms/ui` Tailwind preset:

#### Base Editor Colors

- `--background` - Editor background
- `--foreground` - Default text color
- `--primary` - Cursor color
- `--accent` - Selection background
- `--muted` - Active line highlight background
- `--muted-foreground` - Line numbers and gutter text
- `--border` - Border color (search matches, brackets)
- `--popover` - Autocomplete menu background
- `--popover-foreground` - Autocomplete menu text

#### Syntax Highlighting Colors

- `--editor-keyword` - Keywords (if, else, function, etc.)
- `--editor-string` - String literals
- `--editor-number` - Number literals
- `--editor-comment` - Comments
- `--editor-operator` - Operators (+, -, =, etc.)
- `--editor-punctuation` - Punctuation (brackets, commas, colons)
- `--editor-property` - Object properties and keys
- `--editor-function` - Function names
- `--editor-type` - Type names and classes
- `--editor-constant` - Constants and enums
- `--editor-invalid` - Invalid/error syntax

#### Editor Features

- `--editor-selection-match` - Matching selection highlights
- `--editor-bracket-match` - Matching bracket pairs
- `--editor-fold-placeholder` - Code folding placeholder background
- `--editor-search-match` - Search result highlights
- `--editor-search-match-selected` - Currently selected search result
- `--editor-lint-error` - Linting error markers
- `--editor-lint-warning` - Linting warning markers

**Example values (light theme):**

```css
--editor-keyword: 240 100% 50%;
--editor-string: 0 57% 33%;
--editor-number: 156 100% 30%;
--editor-comment: 120 100% 25%;
--editor-operator: 0 0% 0%;
--editor-punctuation: 0 0% 0%;
--editor-property: 214 100% 25%;
--editor-function: 38 63% 33%;
--editor-type: 156 100% 30%;
--editor-constant: 204 100% 38%;
--editor-invalid: 0 70% 49%;
--editor-selection-match: 207 100% 84%;
--editor-bracket-match: 0 0% 0%;
--editor-fold-placeholder: 220 14% 91%;
--editor-search-match: 60 100% 50%;
--editor-search-match-selected: 60 100% 50%;
--editor-lint-error: 0 63% 49%;
--editor-lint-warning: 32 94% 48%;
```

## Advanced Usage

### Custom Extensions

CodeMirror's extension system is fully accessible:

```tsx
import {CodeMirrorEditor} from '@sqlrooms/codemirror';
import {EditorView} from '@codemirror/view';
import {placeholder} from '@codemirror/view';
import {FC, useState} from 'react';

const MyEditor: FC = () => {
  const [code, setCode] = useState('');
  const extensions = [
    placeholder('Enter your code here...'),
    EditorView.lineWrapping,
  ];

  return <CodeMirrorEditor value={code} onChange={setCode} extensions={extensions} />;
};
```

### Access EditorView Instance

Use the `onMount` callback to access the underlying EditorView:

```tsx
import {CodeMirrorEditor} from '@sqlrooms/codemirror';
import {FC, useState} from 'react';

const MyEditor: FC = () => {
  const [code, setCode] = useState('');

  return (
    <CodeMirrorEditor
      value={code}
      onChange={setCode}
      onMount={(view) => {
        // Access CodeMirror API
        console.log('Document length:', view.state.doc.length);

        // Programmatic updates
        view.dispatch({
          changes: {from: 0, to: view.state.doc.length, insert: 'new content'},
        });

        // Focus the editor
        view.focus();
      }}
    />
  );
};
```

### Read-only Mode

```tsx
import {CodeMirrorEditor} from '@sqlrooms/codemirror';
import {FC} from 'react';

interface ReadOnlyEditorProps {
  code: string;
}

const ReadOnlyEditor: FC<ReadOnlyEditorProps> = ({code}) => {
  return <CodeMirrorEditor value={code} readOnly={true} />;
};
```

## Migration from Monaco

If you're migrating from `@sqlrooms/monaco-editor`, here are the key differences:

### Component Mapping

| Monaco Component                            | CodeMirror Equivalent        | Notes                                  |
| ------------------------------------------- | ---------------------------- | -------------------------------------- |
| `MonacoEditor` with `language="javascript"` | `JavascriptCodeMirrorEditor` | Built-in JSX support                   |
| `JsonMonacoEditor`                          | `JsonCodeMirrorEditor`       | Feature parity for schema validation   |
| `SqlMonacoEditor`                           | `DuckdbCodeMirrorEditor`     | DuckDB dialect with schema completions |

### API Differences

| Monaco                        | CodeMirror                             | Notes                                            |
| ----------------------------- | -------------------------------------- | ------------------------------------------------ |
| `onMount(editor, monaco)`     | `onMount(view)`                        | Receives EditorView instead of Monaco editor     |
| `beforeMount(monaco)`         | ❌ Not available                       | CodeMirror initialization is simpler             |
| `options` (Monaco options)    | `options` + `extensions`               | CodeMirror uses extensions for advanced features |
| `theme: 'vs-dark' \| 'light'` | `theme: 'dark' \| 'light' \| 'system'` | Added system preference support                  |

### Feature Parity

✅ **Fully Supported:**

- Theme integration (light/dark/system)
- Language support (JavaScript/JSX, JSON, SQL/DuckDB)
- Read-only mode
- onChange callback
- Line numbers, line wrapping, code folding
- Syntax highlighting
- JSON schema validation with inline errors
- Schema-based autocomplete
- SQL schema-aware completions and hover tooltips
- Keyboard shortcuts (Cmd+Enter for SQL execution)

⚠️ **Differences:**

- **No TypeScript language server**: CodeMirror provides syntax highlighting only (no type checking or IntelliSense)
- **No minimap**: CodeMirror has no built-in minimap
- **Smaller feature set**: Monaco is a full IDE; CodeMirror is a focused code editor

### Example Migrations

**JavaScript Editor:**

```tsx
// Before (Monaco)
import {MonacoEditor} from '@sqlrooms/monaco-editor';
import {FC, useState} from 'react';

const MyEditor: FC = () => {
  const [code, setCode] = useState('');

  return (
    <MonacoEditor
      language="javascript"
      theme="vs-dark"
      value={code}
      onChange={setCode}
      options={{
        minimap: {enabled: false},
        lineNumbers: 'on',
      }}
    />
  );
};

// After (CodeMirror)
import {JavascriptCodeMirrorEditor} from '@sqlrooms/codemirror';
import {FC, useState} from 'react';

const MyEditor: FC = () => {
  const [code, setCode] = useState('');

  return (
    <JavascriptCodeMirrorEditor
      theme="dark"
      value={code}
      onChange={setCode}
      options={{
        lineNumbers: true,
      }}
    />
  );
};
```

**SQL Editor:**

```tsx
// Before (Monaco)
import {SqlMonacoEditor} from '@sqlrooms/monaco-editor';
import {FC, useState} from 'react';

const SqlEditor: FC = () => {
  const [sql, setSql] = useState('');

  return (
    <SqlMonacoEditor
      value={sql}
      onChange={setSql}
      tableSchemas={schemas}
      onExecuteQuery={handleExecute}
    />
  );
};

// After (CodeMirror)
import {DuckdbCodeMirrorEditor} from '@sqlrooms/codemirror';
import {FC, useState} from 'react';

const SqlEditor: FC = () => {
  const [sql, setSql] = useState('');

  return (
    <DuckdbCodeMirrorEditor
      value={sql}
      onChange={setSql}
      tableSchemas={schemas}
      onRunQuery={handleExecute}
    />
  );
};
```

**JSON Editor:**

```tsx
// Before (Monaco)
import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {FC, useState} from 'react';

const JsonEditor: FC = () => {
  const [json, setJson] = useState({});

  return <JsonMonacoEditor value={json} onChange={setJson} schema={schema} />;
};

// After (CodeMirror) - No changes needed!
import {JsonCodeMirrorEditor} from '@sqlrooms/codemirror';
import {FC, useState} from 'react';

const JsonEditor: FC = () => {
  const [json, setJson] = useState({});

  return <JsonCodeMirrorEditor value={json} onChange={setJson} schema={schema} />;
};
```

## When to Use

### Use CodeMirror When:

- Building PWAs or mobile-first applications where bundle size matters
- Bundle size is a critical concern (~100KB vs Monaco's ~2MB)
- You need basic code editing without full IDE features
- Working with JSON, SQL/DuckDB, or JavaScript/JSX
- You want fast editor initialization and low memory footprint
- You're building data-focused apps (DuckDB SQL support is excellent)

### Use Monaco When:

- You need TypeScript language server with full IntelliSense and type checking
- You require advanced IDE features (minimap, breadcrumbs, multi-cursor editing)
- You need complex language server protocol (LSP) integrations
- Bundle size is not a concern
- You're building a full IDE-like experience

## API Reference

### Exported Components

```typescript
// Base editor component (requires manual theme/language configuration)
export {CodeMirrorEditor} from '@sqlrooms/codemirror';
export type {CodeMirrorEditorProps} from '@sqlrooms/codemirror';

// JSON editor with schema validation and autocomplete
export {JsonCodeMirrorEditor} from '@sqlrooms/codemirror';
export type {JsonCodeMirrorEditorProps} from '@sqlrooms/codemirror';

// DuckDB SQL editor with dialect support and schema-aware completions
export {DuckdbCodeMirrorEditor} from '@sqlrooms/codemirror';
export type {DuckdbCodeMirrorEditorProps} from '@sqlrooms/codemirror';

// JavaScript editor with JSX support
export {JavascriptCodeMirrorEditor} from '@sqlrooms/codemirror';
export type {JavascriptCodeMirrorEditorProps} from '@sqlrooms/codemirror';

// Diagnostic type for validation errors
export type {CodeMirrorDiagnostic} from '@sqlrooms/codemirror';
```

### Internal Extensions (Not Exported)

The following extensions and themes are used internally by the specialized editor components but are not exported from the package. Use the specialized components instead of manually composing these extensions:

- `createSqlroomsTheme()` - Used by JavascriptCodeMirrorEditor
- `createJsonTheme()` - Used by JsonCodeMirrorEditor
- `createSqlTheme()` - Used by DuckdbCodeMirrorEditor
- `createBaseTheme()` - Base theme system
- `jsonSchemaLinter()` - JSON schema validation (used by JsonCodeMirrorEditor)
- `jsonSchemaAutocomplete()` - JSON schema completions (used by JsonCodeMirrorEditor)
- `autoTriggerOnQuote()` - Auto-trigger completions (used by JsonCodeMirrorEditor)
- `createDuckDbExtension()` - DuckDB SQL features (used by DuckdbCodeMirrorEditor)
- `createSqlKeymap()` - SQL keyboard shortcuts (used by DuckdbCodeMirrorEditor)
