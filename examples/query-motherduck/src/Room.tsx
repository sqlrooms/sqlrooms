import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeSwitch} from '@sqlrooms/ui';
import {useRef} from 'react';
import {createRoomStore} from './store';

interface RoomProps {
  mdToken: string;
}

export const Room = ({mdToken}: RoomProps) => {
  const roomStoreRef = useRef<ReturnType<typeof createRoomStore>>(null);
  if (!roomStoreRef.current) {
    roomStoreRef.current = createRoomStore(mdToken);
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
