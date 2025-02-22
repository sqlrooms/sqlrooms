import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {ThemeProvider} from '@sqlrooms/ui';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app.js';
import './index.css';
import {projectStore} from './store.js';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
        <ProjectBuilderProvider projectStore={projectStore}>
          <App />
        </ProjectBuilderProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
