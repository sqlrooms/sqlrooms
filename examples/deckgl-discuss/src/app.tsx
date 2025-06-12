import {RoomShell, RoomShellSidebarButtons} from '@sqlrooms/room-shell';
import {ThemeSwitch} from '@sqlrooms/ui';

export const App = () => (
  <div className="flex h-screen w-full">
    <div className="bg-muted/50 flex w-[46px] flex-col items-center gap-5 pb-4 pt-5">
      <RoomShellSidebarButtons />
      <ThemeSwitch />
    </div>
    <div className="flex flex-grow flex-col">
      <RoomShell />
    </div>
  </div>
);
