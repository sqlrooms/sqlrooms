'use client';

import {createDemoProjectStore} from '@/store/DemoProjectStore';
import {
  DataSourcesPanelAddDataModalContext,
  ProjectStateProvider,
} from '@sqlrooms/project-builder';
import {ThemeProvider as NextThemesProvider} from 'next-themes';
import * as React from 'react';
import {customStorageManager} from '../../../packages/components/src';
import {ChakraProvider} from '@chakra-ui/react';
import theme from './chakra-theme';

const projectStore = createDemoProjectStore();
const colorModeManager = customStorageManager(false);

export function Providers({children}: {children: React.ReactNode}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <ChakraProvider theme={theme} colorModeManager={colorModeManager}>
        <ProjectStateProvider projectStore={projectStore}>
          <DataSourcesPanelAddDataModalContext.Provider value={() => <></>}>
            {children}
          </DataSourcesPanelAddDataModalContext.Provider>
        </ProjectStateProvider>
      </ChakraProvider>
    </NextThemesProvider>
  );
}
