import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeProvider, ThemeSwitch} from '@sqlrooms/ui';
import {roomStore} from './store';

export const App = () => {
  return (
    <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
      <RoomShell className="h-screen" roomStore={roomStore}>
        <RoomShell.Sidebar>
          <ThemeSwitch />
        </RoomShell.Sidebar>
        <div className="relative flex h-full w-full">
          <div> Hello world </div>
          <RoomShell.LayoutComposer />
        </div>
      </RoomShell>
    </ThemeProvider>
  );
};
