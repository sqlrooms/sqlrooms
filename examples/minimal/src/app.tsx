import {ProjectBuilder} from '@sqlrooms/project-builder';
import {ThemeSwitch} from '@sqlrooms/ui';

export const App = () => (
  <div className="flex h-screen w-full">
    <div className="flex w-[46px] flex-col items-center gap-4 pb-4 pt-4">
      <ThemeSwitch />
    </div>
    <div className="flex flex-grow flex-col">
      <ProjectBuilder />
    </div>
  </div>
);
