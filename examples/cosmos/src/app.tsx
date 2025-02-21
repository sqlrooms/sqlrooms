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
    <div className="flex w-full h-screen">
      <div className="flex flex-col w-[46px] items-center pt-5 pb-4 gap-5 bg-muted/50">
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
      <div className="flex flex-col flex-grow">
        <ProjectBuilder />
      </div>
    </div>
  );
};
