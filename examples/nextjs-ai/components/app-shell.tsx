'use client';

import {useProjectStore} from '@/store/store';
import {
  ProjectBuilder,
  ProjectBuilderSidebarButtons,
  SidebarButton,
} from '@sqlrooms/project-builder';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {useDisclosure} from '@sqlrooms/ui';
import {SquareTerminalIcon} from 'lucide-react';

export const AppShell = () => {
  const sqlEditor = useDisclosure();
  const sqlEditorConfig = useProjectStore((s) => s.projectConfig.sqlEditor);
  const onChangeSqlEditorConfig = useProjectStore((s) => s.setSqlEditorConfig);
  const addOrUpdateSqlQuery = useProjectStore(
    (state) => state.addOrUpdateSqlQuery,
  );

  return (
    <div className="flex w-full h-full">
      <div className="flex flex-col h-full bg-gray-900 py-1">
        <ProjectBuilderSidebarButtons />
        <SidebarButton
          title="SQL Editor"
          onClick={sqlEditor.onToggle}
          isSelected={false}
          icon={() => <SquareTerminalIcon />}
        />
      </div>
      <div className="flex flex-col w-full h-full bg-gray-800">
        <ProjectBuilder />
      </div>
      {sqlEditor.isOpen ? (
        <SqlEditorModal
          sqlEditorConfig={sqlEditorConfig}
          onChange={onChangeSqlEditorConfig}
          onAddOrUpdateSqlQuery={addOrUpdateSqlQuery}
          isOpen={sqlEditor.isOpen}
          onClose={sqlEditor.onClose}
        />
      ) : null}
    </div>
  );
};
