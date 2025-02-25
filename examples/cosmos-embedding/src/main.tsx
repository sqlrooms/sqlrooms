import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {ThemeProvider} from '@sqlrooms/ui';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app.js';
import './index.css';
import {projectStore} from './store.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
      <ProjectBuilderProvider projectStore={projectStore}>
        <App />
      </ProjectBuilderProvider>
    </ThemeProvider>
  </StrictMode>,
);
