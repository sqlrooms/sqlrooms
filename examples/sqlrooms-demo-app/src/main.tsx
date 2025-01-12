import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app.tsx';

import {ChakraProvider} from '@chakra-ui/react';
import {customStorageManager, SpinnerPane} from '@sqlrooms/components';
import {ProjectStateProvider} from '@sqlrooms/project-builder';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Suspense} from 'react';
import 'react-mosaic-component/react-mosaic-component.css';
import {createDemoProjectStore} from './store/DemoProjectStore.tsx';
import theme from './theme';

const colorModeManager = customStorageManager(false);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      suspense: true,
    },
  },
});

const projectStore = createDemoProjectStore();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ChakraProvider theme={theme} colorModeManager={colorModeManager}>
        <Suspense fallback={<SpinnerPane h="100%" />}>
          <ProjectStateProvider projectStore={projectStore}>
            <App />
          </ProjectStateProvider>
        </Suspense>
      </ChakraProvider>
    </QueryClientProvider>
  </StrictMode>,
);
