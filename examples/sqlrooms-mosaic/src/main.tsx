import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app.js';
import {ThemeProvider} from './components/ThemeProvider.js';
import './index.css';
import {projectStore} from './store/store.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ProjectBuilderProvider projectStore={projectStore}>
        <App />
      </ProjectBuilderProvider>
    </ThemeProvider>
  </StrictMode>,
);
