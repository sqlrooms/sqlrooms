'use client';

import {roomStore} from '@/app/store';
import {RoomShell, RoomShellProvider} from '@sqlrooms/room-shell';

const AppShell = () => {
  if (!roomStore) {
    return null;
  }
  return (
    <div className="absolute inset-0 flex h-[100vh] w-[100vw]">
      <RoomShellProvider roomStore={roomStore}>
        <RoomShell />
      </RoomShellProvider>
    </div>
  );
};

export default AppShell;
