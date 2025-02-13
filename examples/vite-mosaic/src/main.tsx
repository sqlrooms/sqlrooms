import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app.tsx';
import {ThemeProvider} from './components/ThemeProvider.tsx';
import './index.css';
import {projectStore} from './store/store';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ProjectBuilderProvider projectStore={projectStore}>
        <App />
      </ProjectBuilderProvider>
    </ThemeProvider>
  </StrictMode>,
);
