import {RoomShell} from '@sqlrooms/project-builder';
import {ThemeProvider} from '@sqlrooms/ui';
import {projectStore as roomStore} from './store';

export const App = () => (
  <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.Sidebar />
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
    </RoomShell>
  </ThemeProvider>
);
