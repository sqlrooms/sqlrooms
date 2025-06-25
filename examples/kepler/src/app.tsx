import {
  ProjectBuilder,
  ProjectBuilderSidebarButtons,
  SidebarButton,
} from '@sqlrooms/room-shell';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {ThemeSwitch, useDisclosure} from '@sqlrooms/ui';
import {TerminalIcon} from 'lucide-react';

export const AppShell = () => {
  const sqlEditor = useDisclosure();
  return (
    <div className="flex h-full w-full">
      <div className="bg-muted/50 flex h-full flex-col px-1 py-2">
        <ProjectBuilderSidebarButtons />
        <SidebarButton
          title="SQL Editor"
          onClick={sqlEditor.onToggle}
          isSelected={false}
          icon={TerminalIcon}
        />
        <ThemeSwitch />
      </div>
      <div className="flex h-full w-full flex-col">
        <ProjectBuilder />
      </div>
      <SqlEditorModal isOpen={sqlEditor.isOpen} onClose={sqlEditor.onClose} />
    </div>
  );
};
