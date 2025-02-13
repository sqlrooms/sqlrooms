import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {AppShell} from './app';
import './index.css';
import {projectStore} from './store/store';
import {ThemeProvider} from './components/ThemeProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ProjectBuilderProvider projectStore={projectStore}>
        <AppShell />
      </ProjectBuilderProvider>
    </ThemeProvider>
  </StrictMode>,
);
