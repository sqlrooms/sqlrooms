'use client';

import {createDemoProjectStore} from '@/store/demo-project-store';
import {ChakraProvider} from '@chakra-ui/react';
import {
  ProjectBuilder,
  ProjectBuilderSidebarButtons,
  ProjectStateProvider,
} from '@sqlrooms/project-builder';
import {TooltipProvider} from '@sqlrooms/ui';
import theme from '../app/chakra-theme';

const projectStore = createDemoProjectStore();

export const AppShell = () => {
  return (
    <ChakraProvider theme={theme}>
      <ProjectStateProvider projectStore={projectStore}>
        <TooltipProvider>
          <div className="flex w-full h-full">
            <div className="flex flex-col h-full bg-gray-900">
              <ProjectBuilderSidebarButtons />
            </div>
            <div className="flex flex-col w-full h-full bg-gray-800">
              <ProjectBuilder />
            </div>
          </div>
        </TooltipProvider>
      </ProjectStateProvider>
    </ChakraProvider>
  );
};
