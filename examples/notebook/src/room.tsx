import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeSwitch} from '@sqlrooms/ui';
import {roomStore} from './store';
import {FC} from 'react';

export const Room: FC = () => (
  <RoomShell roomStore={roomStore}>
    <RoomShell.SidebarContainer>
      <RoomShell.TabButtons />
      <div className="flex-1" />
      <ThemeSwitch />
    </RoomShell.SidebarContainer>
    <RoomShell.LayoutComposer />
    <RoomShell.LoadingProgress />
    <RoomShell.LoadingProgress />
  </RoomShell>
);
