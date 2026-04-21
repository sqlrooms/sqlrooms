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
      <RoomShell.SidebarContainer>
        <RoomShell.TabButtons />
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
        <RoomShell.CommandPalette.Button />
        <ThemeSwitch />
      </RoomShell.SidebarContainer>
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
      <RoomShell.CommandPalette />
      <SqlEditorModal isOpen={sqlEditor.isOpen} onClose={sqlEditor.onClose} />
      <RagSearchDialog isOpen={ragTest.isOpen} onClose={ragTest.onClose} />
    </RoomShell>
  );
};
