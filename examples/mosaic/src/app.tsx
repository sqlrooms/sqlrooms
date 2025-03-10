import {
  ProjectBuilder,
  ProjectBuilderSidebarButtons,
  SidebarButton,
} from '@sqlrooms/project-builder';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {ThemeSwitch, useDisclosure} from '@sqlrooms/ui';
import {TerminalIcon} from 'lucide-react';

export const App = () => {
  const sqlEditor = useDisclosure();

  return (
    <div className="flex h-screen w-full">
      <div className="flex w-[46px] flex-col items-center gap-5 pb-4 pt-10">
        <ProjectBuilderSidebarButtons />
        <SidebarButton
          title="SQL Editor"
          onClick={sqlEditor.onToggle}
          isSelected={false}
          icon={TerminalIcon}
        />
        <SqlEditorModal isOpen={sqlEditor.isOpen} onClose={sqlEditor.onClose} />
        <ThemeSwitch />
      </div>
      <div className="flex flex-grow flex-col">
        <ProjectBuilder />
      </div>
    </div>
  );
};
