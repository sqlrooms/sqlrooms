import React from 'react';
import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeSwitch} from '@sqlrooms/ui';
import {roomStore} from './store';

export function Room() {
  return (
    <RoomShell roomStore={roomStore}>
      <RoomShell.Sidebar>
        <ThemeSwitch />
      </RoomShell.Sidebar>
      <RoomShell.LayoutComposer tileClassName="p-0" />
      <RoomShell.LoadingProgress />
    </RoomShell>
  );
}
