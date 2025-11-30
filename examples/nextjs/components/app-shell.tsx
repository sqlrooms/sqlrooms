'use client';

import {roomStore} from '@/app/store';
import {RoomShell} from '@sqlrooms/room-shell';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {useDisclosure} from '@sqlrooms/ui';
import {TerminalIcon} from 'lucide-react';

const AppShell = () => {
  const sqlEditor = useDisclosure();
  return (
    <RoomShell className="h-screen" roomStore={roomStore}>
      <div className="bg-muted/70 flex h-full w-12 flex-col items-center px-1 py-4">
        <RoomShell.SidebarButton
          title="SQL Editor"
          onClick={sqlEditor.onToggle}
          isSelected={false}
          icon={TerminalIcon}
        />
      </div>
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
      <SqlEditorModal isOpen={sqlEditor.isOpen} onClose={sqlEditor.onClose} />
    </RoomShell>
  );
};

export default AppShell;
