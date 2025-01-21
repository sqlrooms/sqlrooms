import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app.tsx';

import {ChakraProvider} from '@chakra-ui/react';
import {customStorageManager, SpinnerPane} from '@sqlrooms/components';
import {ProjectStateProvider} from '@sqlrooms/project-builder';
import {Suspense} from 'react';
import 'react-mosaic-component/react-mosaic-component.css';
import {createDemoProjectStore} from './store/DemoProjectStore.tsx';
import theme from './theme.ts';

const projectStore = createDemoProjectStore();

const colorModeManager = customStorageManager(false);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider theme={theme} colorModeManager={colorModeManager}>
      <Suspense fallback={<SpinnerPane h="100%" />}>
        <ProjectStateProvider projectStore={projectStore}>
          <App />
        </ProjectStateProvider>
      </Suspense>
    </ChakraProvider>
  </StrictMode>,
);
