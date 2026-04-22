import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeProvider, ThemeSwitch} from '@sqlrooms/ui';
import {roomStore} from './store';
import {FC} from 'react';

export const App: FC = () => (
  <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.SidebarContainer>
        <RoomShell.TabButtons />
        <div className="flex-1" />
        <RoomShell.CommandPalette.Button />
        <ThemeSwitch />
      </RoomShell.SidebarContainer>
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
      <RoomShell.CommandPalette />
    </RoomShell>
  </ThemeProvider>
);
