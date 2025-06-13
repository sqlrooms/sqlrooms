'use client';

import {roomStore} from '@/app/store';
import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeSwitch} from '@sqlrooms/ui';

const AppShell = () => {
  return (
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.Sidebar>
        <ThemeSwitch />
      </RoomShell.Sidebar>
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
    </RoomShell>
  );
};

export default AppShell;
