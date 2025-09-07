import {RoomShell, RoomStore} from '@sqlrooms/room-shell';
import {ThemeSwitch} from '@sqlrooms/ui';
import {useRef} from 'react';
import {createRoomStore, RoomConfig} from './store';

export const Room = () => {
  const roomStoreRef = useRef<RoomStore<RoomConfig>>(null);
  if (!roomStoreRef.current) {
    roomStoreRef.current = createRoomStore();
  }

  return (
    <RoomShell className="h-screen" roomStore={roomStoreRef.current}>
      <RoomShell.Sidebar>
        <ThemeSwitch />
      </RoomShell.Sidebar>
      <RoomShell.LayoutComposer />
    </RoomShell>
  );
};

