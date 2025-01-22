import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app.tsx';
import './index.css';

import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {createDemoProjectStore} from './store/DemoProjectStore.tsx';

const projectStore = createDemoProjectStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProjectBuilderProvider projectStore={projectStore}>
      <App />
    </ProjectBuilderProvider>
  </StrictMode>,
);
