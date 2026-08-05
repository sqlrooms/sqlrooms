import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeSwitch} from '@sqlrooms/ui';
import type {FC} from 'react';
import type {createForecastRoomStore} from './store';

export const Room: FC<{
  roomStore: ReturnType<typeof createForecastRoomStore>['roomStore'];
}> = ({roomStore}) => {
  return (
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.SidebarContainer>
        <RoomShell.TabButtons />
        <div className="flex-1" />
        <ThemeSwitch />
      </RoomShell.SidebarContainer>
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
    </RoomShell>
  );
};
