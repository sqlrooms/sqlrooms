import {RoomShell} from '@sqlrooms/room-shell';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {ThemeSwitch, useDisclosure} from '@sqlrooms/ui';
import {SearchIcon, TerminalIcon} from 'lucide-react';
import {RagSearchDialog} from './components/RagSearchDialog';
import {roomStore} from './store';

export const Room = () => {
  const sqlEditor = useDisclosure();
  const ragTest = useDisclosure();
  return (
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.Sidebar className="gap-2">
        <RoomShell.SidebarButton
          title="SQL Editor"
          onClick={sqlEditor.onToggle}
          isSelected={false}
          icon={TerminalIcon}
        />
        <RoomShell.SidebarButton
          title="Test RAG Search"
          onClick={ragTest.onToggle}
          isSelected={false}
          icon={SearchIcon}
        />
        <ThemeSwitch />
      </RoomShell.Sidebar>
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
      <SqlEditorModal isOpen={sqlEditor.isOpen} onClose={sqlEditor.onClose} />
      <RagSearchDialog isOpen={ragTest.isOpen} onClose={ragTest.onClose} />
    </RoomShell>
  );
};
