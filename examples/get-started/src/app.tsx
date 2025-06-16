import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeProvider} from '@sqlrooms/ui';
import {roomStore} from './store';

export const App = () => (
  <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.Sidebar />
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
    </RoomShell>
  </ThemeProvider>
);
