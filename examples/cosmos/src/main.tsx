import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app.js';
import {ThemeProvider} from './components/ThemeProvider.js';
import './index.css';
import {projectStore} from './store.js';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <ProjectBuilderProvider projectStore={projectStore}>
          <App />
        </ProjectBuilderProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
