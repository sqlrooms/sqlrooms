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
      <div className="bg-muted/70 flex h-full w-12 flex-col items-center gap-2 px-1 py-4">
        <RoomShell.SidebarButtons className="h-auto grow-0" />
        <RoomShell.SidebarButton
          title="Test RAG Search"
          onClick={ragTest.onToggle}
          isSelected={false}
          icon={SearchIcon}
        />
        <div className="flex-1" />
        <RoomShell.SidebarButton
          title="SQL Editor"
          onClick={sqlEditor.onToggle}
          isSelected={false}
          icon={TerminalIcon}
        />
        <ThemeSwitch />
      </div>
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
      <SqlEditorModal isOpen={sqlEditor.isOpen} onClose={sqlEditor.onClose} />
      <RagSearchDialog isOpen={ragTest.isOpen} onClose={ragTest.onClose} />
    </RoomShell>
  );
};
