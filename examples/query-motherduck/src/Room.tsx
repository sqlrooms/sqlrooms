import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeSwitch} from '@sqlrooms/ui';
import {createRoomStore} from './store';
import {useMemo} from 'react';

interface RoomProps {
  mdToken: string;
}

export const Room = ({mdToken}: RoomProps) => {
  const roomStore = useMemo(() => createRoomStore(mdToken), [mdToken]);

  return (
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.Sidebar>
        <ThemeSwitch />
      </RoomShell.Sidebar>
      <RoomShell.LayoutComposer />
    </RoomShell>
  );
};
