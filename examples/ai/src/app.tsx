import {
  ProjectBuilder,
  ProjectBuilderSidebarButtons,
  SidebarButton,
} from '@sqlrooms/project-builder';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {ThemeSwitch, useDisclosure} from '@sqlrooms/ui';
import {TerminalIcon} from 'lucide-react';

export const AppShell = () => {
  const sqlEditor = useDisclosure();
  return (
    <div className="flex w-full h-full">
      <div className="flex flex-col h-full py-2 px-1 bg-muted/50">
        <ProjectBuilderSidebarButtons />
        <SidebarButton
          title="SQL Editor"
          onClick={sqlEditor.onToggle}
          isSelected={false}
          icon={TerminalIcon}
        />
        <ThemeSwitch />
      </div>
      <div className="flex flex-col w-full h-full">
        <ProjectBuilder />
      </div>
      <SqlEditorModal isOpen={sqlEditor.isOpen} onClose={sqlEditor.onClose} />
    </div>
  );
};
