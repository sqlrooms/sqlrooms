import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeSwitch} from '@sqlrooms/ui';
import {roomStore} from './store';

export const Room = () => {
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
