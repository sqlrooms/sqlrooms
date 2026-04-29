import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeProvider, ThemeSwitch} from '@sqlrooms/ui';
import {roomStore, useRoomStore} from './store';
import {FC} from 'react';
import {CollapseBottomButton} from './components/CollapseBottomButton';

export const App: FC = () => {
  const addDashboard = useRoomStore((s) => s.addDashboard);

  return (
    <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
      <RoomShell className="h-screen" roomStore={roomStore}>
        <RoomShell.SidebarContainer>
          <RoomShell.TabButtons />
          <div className="flex-1" />
          <CollapseBottomButton />
          <RoomShell.CommandPalette.Button />
          <ThemeSwitch />
        </RoomShell.SidebarContainer>
        <RoomShell.LayoutComposer onTabCreate={addDashboard} />
        <RoomShell.CommandPalette />
      </RoomShell>
    </ThemeProvider>
  );
};
