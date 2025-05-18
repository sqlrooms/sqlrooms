import {
  ProjectBuilder,
  ProjectBuilderSidebarButtons,
} from '@sqlrooms/project-builder';
import {ThemeSwitch} from '@sqlrooms/ui';

export const App = () => (
  <div className="flex h-screen w-full">
    <div className="bg-muted/50 flex w-[46px] flex-col items-center gap-5 pb-4 pt-5">
      <ProjectBuilderSidebarButtons />
      <ThemeSwitch />
    </div>
    <div className="flex flex-grow flex-col">
      <ProjectBuilder />
    </div>
  </div>
);
