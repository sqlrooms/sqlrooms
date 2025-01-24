'use client';

import {createDemoProjectStore} from '@/store/demo-project-store';
import {ProjectBuilderProvider} from '@sqlrooms/project-builder';
import {ThemeProvider as NextThemesProvider} from 'next-themes';
import * as React from 'react';
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
      <ProjectBuilderProvider projectStore={projectStore}>
        {children}
      </ProjectBuilderProvider>
    </NextThemesProvider>
  );
}
