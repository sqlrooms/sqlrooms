import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import {App} from './App';

// Configure the monaco loader to bundle the editor with Vite
import {configureMonacoLoader} from '@sqlrooms/monaco-editor';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

configureMonacoLoader({
  monaco,
  workers: {
    default: editorWorker,
    json: jsonWorker,
    css: cssWorker,
    html: htmlWorker,
    typescript: tsWorker,
    javascript: tsWorker,
    scss: cssWorker,
    less: cssWorker,
    handlebars: htmlWorker,
    razor: htmlWorker,
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
