import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
// import {registerSW} from 'virtual:pwa-register';
import './index.css';
import {App} from './App';

// Configure the monaco loader to bundle the editor with Vite for offline work
import {configureMonacoLoader} from '@sqlrooms/monaco-editor';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

/** We only need the default worker for the SQL editor */
// import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
// import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
// import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
// import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

configureMonacoLoader({
  monaco,
  workers: {
    default: editorWorker,
    // json: jsonWorker,
    // css: cssWorker,
    // html: htmlWorker,
    // typescript: tsWorker,
    // javascript: tsWorker,
    // scss: cssWorker,
    // less: cssWorker,
    // handlebars: htmlWorker,
    // razor: htmlWorker,
  },
});

// registerSW({immediate: true});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
