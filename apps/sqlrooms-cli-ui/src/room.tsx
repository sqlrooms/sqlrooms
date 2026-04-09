import {RoomShell} from '@sqlrooms/room-shell';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {ThemeProvider, ThemeSwitch, useDisclosure} from '@sqlrooms/ui';
import {TerminalIcon} from 'lucide-react';
import {roomStore} from './store';

export const Room = () => {
  const sqlEditor = useDisclosure();
  return (
    <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-cli-ui-theme">
      <RoomShell className="h-screen" roomStore={roomStore}>
        <RoomShell.SidebarContainer>
          <RoomShell.TabButtons tabsId="left" />
          <div className="flex-1" />
          <RoomShell.SidebarButton
            title="SQL Editor"
            onClick={sqlEditor.onToggle}
            isSelected={false}
            icon={TerminalIcon}
          />
          <RoomShell.CommandPalette.Button />
          <ThemeSwitch />
        </RoomShell.SidebarContainer>
        <RoomShell.LayoutComposer />
        <RoomShell.LoadingProgress />
        <RoomShell.CommandPalette />
        <SqlEditorModal isOpen={sqlEditor.isOpen} onClose={sqlEditor.onClose} />
      </RoomShell>
    </ThemeProvider>
  );
};
