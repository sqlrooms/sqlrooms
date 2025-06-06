import {
  ProjectBuilder,
  ProjectBuilderProvider,
} from '@sqlrooms/project-builder';
import {ThemeProvider, ThemeSwitch} from '@sqlrooms/ui';
import {projectStore} from './store';

export const App = () => (
  <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-ui-theme">
    <ProjectBuilderProvider projectStore={projectStore}>
      <div className="flex h-screen w-full">
        <div className="flex w-[46px] flex-col items-center gap-4 pb-4 pt-4">
          <ThemeSwitch />
        </div>
        <div className="flex flex-grow flex-col">
          <ProjectBuilder />
        </div>
      </div>
    </ProjectBuilderProvider>
  </ThemeProvider>
);
