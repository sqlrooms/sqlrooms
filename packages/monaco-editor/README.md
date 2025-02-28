# @sqlrooms/monaco-editor

Monaco Editor components for SQLRooms, including specialized editors for JSON and SQL (DuckDB).

## Installation

```bash
npm install @sqlrooms/monaco-editor
```

## Components

### MonacoEditor

A base Monaco Editor component with common functionality.

```tsx
import {MonacoEditor} from '@sqlrooms/monaco-editor';

function MyComponent() {
  return (
    <MonacoEditor
      className="h-[400px]"
      language="javascript"
      value="// Your code here"
      onChange={(value) => console.log(value)}
    />
  );
}
```

### JsonMonacoEditor

A specialized Monaco Editor for editing JSON with schema validation.

```tsx
import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';

function MyJsonEditor() {
  const schema = {
    type: 'object',
    properties: {
      name: {type: 'string'},
      age: {type: 'number'},
    },
    required: ['name'],
  };

  return (
    <JsonMonacoEditor
      className="h-[400px]"
      value={{name: 'John', age: 30}}
      schema={schema}
      onChange={(value) => console.log(value)}
    />
  );
}
```

### SqlMonacoEditor

A specialized Monaco Editor for editing SQL with DuckDB syntax highlighting and autocompletion.

```tsx
import {SqlMonacoEditor} from '@sqlrooms/monaco-editor';

function MySqlEditor() {
  const tableSchemas = {
    users: {
      id: 'INTEGER',
      name: 'VARCHAR',
      email: 'VARCHAR',
      created_at: 'TIMESTAMP',
    },
    orders: {
      id: 'INTEGER',
      user_id: 'INTEGER',
      amount: 'DECIMAL',
      created_at: 'TIMESTAMP',
    },
  };

  return (
    <SqlMonacoEditor
      className="h-[400px]"
      value="SELECT * FROM users JOIN orders ON users.id = orders.user_id"
      tableSchemas={tableSchemas}
      onChange={(value) => console.log(value)}
    />
  );
}
```

## Props

### MonacoEditor Props

| Prop      | Type                 | Default      | Description                              |
| --------- | -------------------- | ------------ | ---------------------------------------- |
| className | string               | ''           | CSS class name for the editor container  |
| language  | string               | 'javascript' | The language of the editor               |
| theme     | 'vs-dark' \| 'light' | 'vs-dark'    | The theme of the editor                  |
| value     | string               | ''           | The value of the editor                  |
| readOnly  | boolean              | false        | Whether the editor is read-only          |
| options   | object               | {}           | Additional options for the editor        |
| onMount   | function             | -            | Callback when the editor is mounted      |
| onChange  | function             | -            | Callback when the editor content changes |

### JsonMonacoEditor Props

Extends `MonacoEditorProps` with:

| Prop   | Type             | Default | Description                         |
| ------ | ---------------- | ------- | ----------------------------------- |
| schema | object           | -       | The JSON schema to validate against |
| value  | string \| object | ''      | The JSON value to edit              |

### SqlMonacoEditor Props

Extends `MonacoEditorProps` with:

| Prop            | Type     | Default | Description                                            |
| --------------- | -------- | ------- | ------------------------------------------------------ |
| customKeywords  | string[] | []      | Custom SQL keywords to add to the completion provider  |
| customFunctions | string[] | []      | Custom SQL functions to add to the completion provider |
| tableSchemas    | object   | {}      | Table schemas for autocompletion                       |

## License

MIT
