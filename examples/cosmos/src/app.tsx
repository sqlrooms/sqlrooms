import {RoomShell} from '@sqlrooms/room-shell';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {ThemeSwitch, useDisclosure} from '@sqlrooms/ui';
import {TerminalIcon} from 'lucide-react';
import {roomStore} from './store';

export const App = () => {
  const sqlEditorDisclosure = useDisclosure();
  return (
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.Sidebar>
        <RoomShell.SidebarButton
          title="SQL Editor"
          onClick={sqlEditorDisclosure.onToggle}
          isSelected={false}
          icon={TerminalIcon}
        />
        <ThemeSwitch />
      </RoomShell.Sidebar>
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
      <SqlEditorModal
        isOpen={sqlEditorDisclosure.isOpen}
        onClose={sqlEditorDisclosure.onClose}
      />
    </RoomShell>
  );
};
