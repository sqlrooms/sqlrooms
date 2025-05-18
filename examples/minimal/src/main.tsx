import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {ThemeProvider} from '@sqlrooms/ui';
import {App} from './app.js';
import {projectStore} from './store.js';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-ui-theme">
      <ProjectBuilderProvider projectStore={projectStore}>
        <App />
      </ProjectBuilderProvider>
    </ThemeProvider>
  </StrictMode>,
);
