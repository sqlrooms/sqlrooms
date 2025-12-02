import {ThemeProvider} from '@sqlrooms/ui';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Room} from './room';
import './index.css';

import {configureMonacoLoader} from '@sqlrooms/monaco-editor';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
configureMonacoLoader({monaco, workers: {default: editorWorker}});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-ui-theme">
      <Room />
    </ThemeProvider>
  </StrictMode>,
);
