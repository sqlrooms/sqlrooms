import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {ThemeProvider} from '@sqlrooms/ui';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {AppShell} from './app';
import './index.css';
import {projectStore} from './store';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-ui-theme">
      <ProjectBuilderProvider projectStore={projectStore}>
        <AppShell />
      </ProjectBuilderProvider>
    </ThemeProvider>
  </StrictMode>,
);
