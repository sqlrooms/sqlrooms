# @sqlrooms/codemirror-editor

CodeMirror 6 editor components for SQLRooms with theme integration, JSON schema validation, and autocomplete.

A lightweight alternative to `@sqlrooms/monaco-editor` with ~100KB bundle size vs Monaco's ~2MB.

## Features

- 🎨 **Theme Integration** - Seamless integration with SQLRooms theme system (light/dark/system)
- 🌐 **Language Support** - JavaScript, JSON, and SQL syntax highlighting
- ✅ **JSON Schema Validation** - Real-time validation with inline error markers
- 💡 **Schema-based Autocomplete** - Intelligent completions for JSON editing
- 🔒 **Read-only Mode** - Support for non-editable views
- ⚡ **Lightweight** - Significantly smaller bundle size than Monaco
- 🎯 **Similar API** - Familiar interface for Monaco users

## Installation

```bash
pnpm add @sqlrooms/codemirror-editor
```

## Quick Start

### Basic JavaScript Editor

```tsx
import {CodeMirrorEditor} from '@sqlrooms/codemirror-editor';

function MyEditor() {
  const [code, setCode] = useState('console.log("Hello, world!");');

  return (
    <CodeMirrorEditor
      language="javascript"
      value={code}
      onChange={setCode}
      className="h-96"
    />
  );
}
```

### JSON Editor with Schema Validation

```tsx
import {JsonCodeMirrorEditor} from '@sqlrooms/codemirror-editor';

const schema = {
  type: 'object',
  properties: {
    name: {type: 'string', description: 'User name'},
    age: {type: 'number', minimum: 0},
    email: {type: 'string', format: 'email'},
  },
  required: ['name', 'email'],
};

function MyJsonEditor() {
  const [json, setJson] = useState('{\n  "name": ""\n}');

  return (
    <JsonCodeMirrorEditor
      schema={schema}
      value={json}
      onChange={setJson}
      className="h-96"
    />
  );
}
```

### SQL Editor

```tsx
import {CodeMirrorEditor} from '@sqlrooms/codemirror-editor';

function MySqlEditor() {
  const [sql, setSql] = useState('SELECT * FROM users;');

  return (
    <CodeMirrorEditor
      language="sql"
      value={sql}
      onChange={setSql}
      options={{
        lineNumbers: true,
        lineWrapping: true,
      }}
    />
  );
}
```

## Components

### CodeMirrorEditor

Base editor component with theme integration and language support.

#### Props

```typescript
interface CodeMirrorEditorProps {
  className?: string;                      // CSS class for container
  language?: 'javascript' | 'json' | 'sql'; // Editor language (default: 'javascript')
  theme?: 'dark' | 'light';               // Explicit theme or auto-detect
  value?: string;                          // Editor content
  readOnly?: boolean;                      // Read-only mode (default: false)
  onChange?: (value: string) => void;     // Content change callback
  onMount?: (view: EditorView) => void;   // Mount callback with EditorView
  extensions?: Extension[];                // Additional CodeMirror extensions
  options?: {
    lineNumbers?: boolean;                 // Show line numbers (default: true)
    lineWrapping?: boolean;                // Wrap long lines (default: false)
    highlightActiveLine?: boolean;         // Highlight current line (default: true)
    foldGutter?: boolean;                  // Show code folding gutter (default: true)
    autocompletion?: boolean;              // Enable autocomplete (default: true)
  };
}
```

#### Example

```tsx
<CodeMirrorEditor
  language="javascript"
  value={code}
  onChange={setCode}
  onMount={(view) => {
    console.log('Editor mounted:', view);
  }}
  options={{
    lineNumbers: true,
    lineWrapping: true,
    foldGutter: true,
  }}
/>
```

### JsonCodeMirrorEditor

JSON editor with schema validation and autocomplete.

#### Props

```typescript
interface JsonCodeMirrorEditorProps extends Omit<CodeMirrorEditorProps, 'language' | 'value'> {
  schema?: object;                         // JSON schema for validation
  value?: string | object;                 // JSON value (auto-stringifies objects)
  onValidate?: (errors: ValidationError[]) => void; // Validation callback
}

interface ValidationError {
  message: string;
  path: string;
  from: number;
  to: number;
  severity: 'error' | 'warning';
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

<JsonCodeMirrorEditor
  schema={schema}
  value={{status: 'active'}}
  onChange={setJson}
  options={{
    lineNumbers: false,
    lineWrapping: true,
  }}
/>
```

## Theme Integration

Both components automatically integrate with SQLRooms' theme system via the `useTheme()` hook:

- **Light Mode**: Uses light theme colors from CSS variables
- **Dark Mode**: Uses dark theme colors from CSS variables
- **System Preference**: Automatically detects and follows system dark mode preference

### Custom Theme

You can explicitly set the theme:

```tsx
<CodeMirrorEditor theme="dark" value={code} />
<CodeMirrorEditor theme="light" value={code} />
```

### Theme Colors

Themes use Tailwind CSS variables:

- `--background` - Editor background
- `--foreground` - Text color
- `--primary` - Cursor color
- `--accent` - Selection color
- `--muted` - Line highlight color
- `--muted-foreground` - Line number color
- `--border` - Border color
- `--popover` - Menu/tooltip background
- `--popover-foreground` - Menu/tooltip text

## Advanced Usage

### Custom Extensions

CodeMirror's extension system is fully accessible:

```tsx
import {CodeMirrorEditor} from '@sqlrooms/codemirror-editor';
import {EditorView} from '@codemirror/view';
import {placeholder} from '@codemirror/view';

function MyEditor() {
  const extensions = [
    placeholder('Enter your code here...'),
    EditorView.lineWrapping,
  ];

  return (
    <CodeMirrorEditor
      value={code}
      extensions={extensions}
    />
  );
}
```

### Access EditorView Instance

Use the `onMount` callback to access the underlying EditorView:

```tsx
<CodeMirrorEditor
  value={code}
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
```

### Read-only Mode

```tsx
<CodeMirrorEditor
  value={code}
  readOnly={true}
/>
```

## Migration from Monaco

If you're migrating from `@sqlrooms/monaco-editor`, here are the key differences:

### API Differences

| Monaco | CodeMirror | Notes |
|--------|------------|-------|
| `onMount(editor, monaco)` | `onMount(view)` | Receives EditorView instead of Monaco editor |
| `beforeMount(monaco)` | ❌ Not available | CodeMirror initialization is simpler |
| `options` (Monaco options) | `options` + `extensions` | CodeMirror uses extensions for most features |
| `theme: 'vs-dark' \| 'light'` | `theme: 'dark' \| 'light'` | Simplified theme names |

### Feature Parity

✅ **Supported:**
- Theme integration (light/dark/system)
- Language support (JavaScript, JSON, SQL)
- Read-only mode
- onChange callback
- Line numbers, line wrapping
- Syntax highlighting
- JSON schema validation
- Schema-based autocomplete

⚠️ **Differences:**
- **No TypeScript language server**: CodeMirror provides basic syntax highlighting only
- **No minimap**: CodeMirror has no built-in minimap (can add via extension if needed)
- **SQL dialect**: Basic SQL mode (may need custom parser for full DuckDB support)

### Example Migration

**Before (Monaco):**

```tsx
import {MonacoEditor} from '@sqlrooms/monaco-editor';

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
```

**After (CodeMirror):**

```tsx
import {CodeMirrorEditor} from '@sqlrooms/codemirror-editor';

<CodeMirrorEditor
  language="javascript"
  theme="dark"
  value={code}
  onChange={setCode}
  options={{
    lineNumbers: true,
  }}
/>
```

## When to Use

### Use CodeMirror When:
- Building PWAs or mobile-first applications
- Bundle size is a concern (~100KB vs Monaco's ~2MB)
- You need basic code editing without IDE features
- Working with JSON, SQL, or JavaScript

### Use Monaco When:
- You need TypeScript language server with IntelliSense
- You require advanced IDE features (minimap, breadcrumbs, etc.)
- You need complex SQL dialect support (DuckDB-specific)
- You're already using Monaco elsewhere

## API Reference

### Exports

```typescript
// Components
export {CodeMirrorEditor} from '@sqlrooms/codemirror-editor';
export {JsonCodeMirrorEditor} from '@sqlrooms/codemirror-editor';

// Themes
export {createSqlroomsTheme} from '@sqlrooms/codemirror-editor';
export {createJsonTheme} from '@sqlrooms/codemirror-editor';

// Extensions
export {jsonSchemaLinter} from '@sqlrooms/codemirror-editor';
export {jsonSchemaAutocomplete} from '@sqlrooms/codemirror-editor';
export {autoTriggerOnQuote} from '@sqlrooms/codemirror-editor';

// Utilities
export {getCssColor, hslToHex, getMonospaceFont} from '@sqlrooms/codemirror-editor';
```

## License

MIT

## Contributing

Contributions welcome! See [SQLRooms repository](https://github.com/sqlrooms/sqlrooms) for contribution guidelines.
