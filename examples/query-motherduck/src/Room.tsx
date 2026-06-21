import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeSwitch} from '@sqlrooms/ui';
import {FC, useRef} from 'react';
import {createRoomStore} from './store';

interface RoomProps {
  mdToken: string;
}

export const Room: FC<RoomProps> = ({mdToken}) => {
  const roomStoreRef = useRef<ReturnType<typeof createRoomStore>>(null);
  if (!roomStoreRef.current) {
    roomStoreRef.current = createRoomStore(mdToken);
  }

  return (
    <RoomShell className="h-screen" roomStore={roomStoreRef.current}>
      <RoomShell.SidebarContainer>
        <RoomShell.TabButtons />
        <div className="flex-1" />
        <RoomShell.CommandPalette.Button />
        <ThemeSwitch />
      </RoomShell.SidebarContainer>
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
    </RoomShell>
  );
};
