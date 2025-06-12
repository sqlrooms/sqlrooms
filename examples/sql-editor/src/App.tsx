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
        <RoomShell.LayoutComposer />
        <RoomShell.LoadingProgress />
      </RoomShell>
    </ThemeProvider>
  );
};
