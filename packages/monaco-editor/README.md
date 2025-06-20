This package is part of the SQLRooms framework.

# Monaco Editor

Monaco Editor components for SQLRooms, including specialized editors for JSON.

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

### Configuring the loader

By default, the editor loads its sources from a CDN. You can change this
behaviour using the `configureMonacoLoader` utility which is a thin wrapper
around the [`loader.config` function](https://github.com/suren-atoyan/monaco-react#loader-config).
This allows bundling `monaco-editor` with your application or using a different
CDN path.

```ts
import {configureMonacoLoader} from '@sqlrooms/monaco-editor';
import * as monaco from 'monaco-editor';

// Use the monaco-editor package instead of CDN
configureMonacoLoader({monaco});

// Or specify a custom path
// configureMonacoLoader({paths: {vs: 'https://unpkg.com/monaco-editor/min/vs'}});
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

## License

MIT
