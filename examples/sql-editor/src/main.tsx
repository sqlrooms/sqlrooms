import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {ThemeProvider} from '@sqlrooms/ui';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import {MainView} from './MainView';
import {projectStore} from './store';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="absolute inset-0">
      <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-ui-theme">
        <ProjectBuilderProvider projectStore={projectStore}>
          <MainView />
        </ProjectBuilderProvider>
      </ThemeProvider>
    </div>
  </StrictMode>,
);
