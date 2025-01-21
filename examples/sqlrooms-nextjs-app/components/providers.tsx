'use client';

import {createDemoProjectStore} from '@/store/demo-project-store';
import {ChakraProvider} from '@chakra-ui/react';
import {ProjectStateProvider} from '@sqlrooms/project-builder';
import {TooltipProvider} from '@sqlrooms/ui/index';
import {ThemeProvider as NextThemesProvider} from 'next-themes';
import * as React from 'react';
import theme from './chakra-theme';
const projectStore = createDemoProjectStore();

export function Providers({children}: {children: React.ReactNode}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <ChakraProvider theme={theme}>
        <ProjectStateProvider projectStore={projectStore}>
          <TooltipProvider>{children}</TooltipProvider>
        </ProjectStateProvider>
      </ChakraProvider>
    </NextThemesProvider>
  );
}
