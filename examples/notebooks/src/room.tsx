import React from 'react';
import {RoomShell} from '@sqlrooms/room-shell';
import {roomStore} from './store';

export function Room() {
  return (
    <RoomShell roomStore={roomStore}>
      <RoomShell.Sidebar />
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
    </RoomShell>
  );
}

