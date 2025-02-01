import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app.tsx';
import './index.css';

import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {createDemoProjectStore} from './store/DemoProjectStore.tsx';
import {ThemeProvider} from './components/ThemeProvider.tsx';

const projectStore = createDemoProjectStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ProjectBuilderProvider projectStore={projectStore}>
        <App />
      </ProjectBuilderProvider>
    </ThemeProvider>
  </StrictMode>,
);
