import {
  ProjectBuilder,
  ProjectBuilderProvider,
} from '@sqlrooms/project-builder';
import {ThemeProvider} from '@sqlrooms/ui';
import {projectStore} from './store';

export const App = () => (
  <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
    <ProjectBuilderProvider projectStore={projectStore}>
      <div className="h-screen w-full">
        <ProjectBuilder />
      </div>
    </ProjectBuilderProvider>
  </ThemeProvider>
);
