import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeSwitch} from '@sqlrooms/ui';
import {InputApiKey} from './components/InputApiKey';
import {roomStore} from './store';
import {FC} from 'react';

export const Room: FC = () => {
  return (
    <RoomShell className="h-screen w-screen" roomStore={roomStore}>
      <RoomShell.SidebarContainer>
        <RoomShell.TabButtons />
        <div className="flex-1" />
        <RoomShell.CommandPalette.Button />
        <ThemeSwitch />
      </RoomShell.SidebarContainer>
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
      <RoomShell.CommandPalette />
      <InputApiKey className="absolute top-5 right-15 z-10" />
    </RoomShell>
  );
};
