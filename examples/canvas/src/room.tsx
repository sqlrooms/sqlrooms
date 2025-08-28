import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeSwitch} from '@sqlrooms/ui';
import {InputApiKey} from './InputApiKey';
import {roomStore} from './store';

export function Room() {
  return (
    <RoomShell className="h-screen w-screen" roomStore={roomStore}>
      <RoomShell.Sidebar>
        <ThemeSwitch />
      </RoomShell.Sidebar>
      <RoomShell.LayoutComposer tileClassName="p-0" />
      <RoomShell.LoadingProgress />
      <InputApiKey className="absolute right-[60px] top-5 z-10" />
    </RoomShell>
  );
}
