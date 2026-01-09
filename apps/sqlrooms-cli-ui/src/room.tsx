import {ThemeProvider} from '@sqlrooms/ui';
import {RoomShell} from '@sqlrooms/room-shell';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {ThemeSwitch, useDisclosure} from '@sqlrooms/ui';
import {TerminalIcon} from 'lucide-react';
import {roomStore} from './store';

export const Room = () => {
  const sqlEditor = useDisclosure();
  return (
    <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-cli-ui-theme">
      <RoomShell className="h-screen" roomStore={roomStore}>
        <RoomShell.Sidebar>
          <RoomShell.SidebarButton
            title="SQL Editor"
            onClick={sqlEditor.onToggle}
            isSelected={false}
            icon={TerminalIcon}
          />
          <ThemeSwitch />
        </RoomShell.Sidebar>
        <RoomShell.LayoutComposer />
        <RoomShell.LoadingProgress />
        <SqlEditorModal isOpen={sqlEditor.isOpen} onClose={sqlEditor.onClose} />
      </RoomShell>
    </ThemeProvider>
  );
};
