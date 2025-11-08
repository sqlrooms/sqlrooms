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

### Offline Use and Bundling

By default, the editor loads from a CDN, which is SSR-friendly (works with Next.js) and reduces bundle size.

For offline environments (like PWAs), configure Monaco once at app startup:

```ts
// main.tsx or app entry point
import {configureMonacoLoader} from '@sqlrooms/monaco-editor';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

configureMonacoLoader({
  monaco,
  workers: {
    default: editorWorker,
    json: jsonWorker,
    typescript: tsWorker,
    javascript: tsWorker,
  },
});
```

Now all `<MonacoEditor />` components automatically work offline:

```tsx
// No configuration needed - automatically detected!
<MonacoEditor language="javascript" value="// Works offline!" />
```

**Note:** Vite requires the `?worker` suffix on worker imports. This is a thin wrapper around the [`loader.config` function](https://github.com/suren-atoyan/monaco-react#loader-config).

#### Custom CDN path

You can also specify a custom CDN path:

```ts
configureMonacoLoader({paths: {vs: 'https://unpkg.com/monaco-editor/min/vs'}});
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
